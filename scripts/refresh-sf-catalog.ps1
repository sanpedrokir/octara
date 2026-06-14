# Refresh the SkillsFuture course catalog from data.gov.sg
# Run from the project root: pwsh scripts/refresh-sf-catalog.ps1

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "Fetching download URL from data.gov.sg..."
$datasetId = "d_b5802b76f409764c16dde4bf2feb19cd"
$resp = Invoke-RestMethod -Uri "https://api-open.data.gov.sg/v1/public/api/datasets/$datasetId/poll-download" -Method GET -TimeoutSec 20
$url = $resp.data.url

Write-Host "Downloading MySkillsFutureCourseDirectory.xlsx..."
$tempFile = "$env:TEMP\sf_courses.xlsx"
Invoke-WebRequest -Uri $url -OutFile $tempFile -TimeoutSec 120
Write-Host "Downloaded $([Math]::Round((Get-Item $tempFile).Length / 1MB, 1)) MB"

Add-Type -Assembly "System.IO.Compression.FileSystem"
$zip = [System.IO.Compression.ZipFile]::OpenRead($tempFile)

$ssEntry = $zip.Entries | Where-Object { $_.FullName -eq "xl/sharedStrings.xml" }
$ssReader = New-Object System.IO.StreamReader($ssEntry.Open())
[xml]$parsedSS = $ssReader.ReadToEnd()
$ssReader.Close()
$strings = @($parsedSS.sst.si | ForEach-Object {
    if ($_.t) { $_.t } elseif ($_.r) { ($_.r | ForEach-Object { $_.t }) -join "" } else { "" }
})

$sheetEntry = $zip.Entries | Where-Object { $_.FullName -eq "xl/worksheets/sheet1.xml" }
$shReader = New-Object System.IO.StreamReader($sheetEntry.Open())
$shXml = $shReader.ReadToEnd()
$shReader.Close()
$zip.Dispose()

Write-Host "Parsing courses..."
$courses = [System.Collections.Generic.List[object]]::new()
$rowMatches = [regex]::Matches($shXml, '<row r="(\d+)"[^>]*>(.*?)</row>')

foreach ($rowMatch in $rowMatches) {
    $rowNum = [int]$rowMatch.Groups[1].Value
    if ($rowNum -eq 1) { continue }
    $rowXml = $rowMatch.Groups[2].Value
    $cellFull = [regex]::Matches($rowXml, '<c r="([A-Z]+)\d+"(?:[^>]*\st="([^"]*)")?[^>]*><v>([^<]*)</v></c>')
    $row = @{}
    foreach ($cell in $cellFull) {
        $col = $cell.Groups[1].Value
        $type = $cell.Groups[2].Value
        $val = $cell.Groups[3].Value
        if ($col -in @('A','B','D','L','M','N')) {
            if ($type -eq 's') { $row[$col] = $strings[[int]$val] } else { $row[$col] = $val }
        }
    }
    $refNum = if ($row.ContainsKey('A')) { [string]$row['A'] } else { '' }
    $title = if ($row.ContainsKey('B')) { [string]$row['B'] } else { '' }
    if ($refNum -and $title) {
        $provider = if ($row.ContainsKey('D')) { [string]$row['D'] } else { '' }
        $fullFee = if ($row.ContainsKey('L') -and $row['L']) { [double]$row['L'] } else { 0.0 }
        $subFee = if ($row.ContainsKey('M') -and $row['M']) { [double]$row['M'] } else { 0.0 }
        $hours = if ($row.ContainsKey('N') -and $row['N']) { [int]([double]$row['N']) } else { 0 }
        $courses.Add([PSCustomObject]@{ r=$refNum; t=$title; p=$provider; f=$fullFee; s=$subFee; h=$hours })
    }
}

Write-Host "Parsed $($courses.Count) courses"
$outDir = Join-Path (Split-Path $PSScriptRoot -Parent) "data"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outPath = Join-Path $outDir "sf-courses.json"
$json = "[" + (($courses | ForEach-Object { "{`"r`":`"$($_.r)`",`"t`":`"$($_.t -replace '"','\"')`",`"p`":`"$($_.p -replace '"','\"')`",`"f`":$($_.f),`"s`":$($_.s),`"h`":$($_.h)}" }) -join ",") + "]"
[System.IO.File]::WriteAllText($outPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Saved $([Math]::Round((Get-Item $outPath).Length / 1MB, 2)) MB to $outPath"
