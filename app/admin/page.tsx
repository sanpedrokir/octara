'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Industry, JobRole } from '@/lib/types';

type Tab = 'overview' | 'industries' | 'job-roles' | 'catalog' | 'skills-mapping' | 'tsc-ccs' | 'esco';

type CatalogRow = {
  id: number;
  sector: string;
  track: string | null;
  job_role: string;
  job_role_description: string | null;
  performance_expectation: string | null;
};

type CatalogUpload = { filename: string | null; row_count: number; skipped_count: number; created_at: string };

type MappingRow = {
  id: number;
  skill_code: string | null;
  skill_title: string;
  skill_desc: string | null;
  skill_proficiency_level: string | null;
  proficiency_level_desc: string | null;
  previous_skill_title: string | null;
  previous_sfs_status: string | null;
  previous_casl_status: string | null;
  previous_skill_type: string | null;
  updated_skill_title: string | null;
  updated_skill_sfs_status: string | null;
  updated_casl_status: string | null;
  updated_skill_type: string | null;
  updated_sector_tagging: string | null;
};

type SyncMeta = {
  totalIndustries: number;
  totalRoles: number;
  industriesAdded: number;
  rolesAdded: number;
  errors: string[] | null;
};

function timeAgo(isoDate: string): string {
  const secs = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  return `${Math.floor(secs / 86400)} days ago`;
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<{ meta: SyncMeta; at: string } | null>(null);

  const [newIndustry, setNewIndustry] = useState({ name: '', description: '' });
  const [newRole, setNewRole] = useState({ name: '', description: '', skill_keywords: '' });

  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [catalogUploading, setCatalogUploading] = useState(false);
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogSectors, setCatalogSectors] = useState<string[]>([]);
  const [catalogLastUpload, setCatalogLastUpload] = useState<CatalogUpload | null>(null);
  const [catalogSectorFilter, setCatalogSectorFilter] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(0);
  const CATALOG_PAGE_SIZE = 50;

  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [mappingUploading, setMappingUploading] = useState(false);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [mappingTotal, setMappingTotal] = useState(0);
  const [mappingSectors, setMappingSectors] = useState<string[]>([]);
  const [mappingLastUpload, setMappingLastUpload] = useState<CatalogUpload | null>(null);
  const [mappingSectorFilter, setMappingSectorFilter] = useState('');
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingPage, setMappingPage] = useState(0);
  const MAPPING_PAGE_SIZE = 50;

  // ESCO tab state
  type EscoOccRow   = { id: number; isco_group: string; sub_group: string | null; occupation_title: string; occupation_description: string | null; esco_uri: string | null };
  type EscoSkillRow = { id: number; isco_group: string; occupation_title: string; skill_title: string; skill_type: string | null; esco_skill_uri: string | null };
  type EscoUpload   = { filename: string | null; occ_count: number; skill_count: number; skipped_count: number; created_at: string };
  const [escoFile, setEscoFile]             = useState<File | null>(null);
  const [escoUploading, setEscoUploading]   = useState(false);
  const [escoFetching, setEscoFetching]     = useState<'occupations' | 'skills' | 'all' | null>(null);
  const [escoView, setEscoView]             = useState<'occupations' | 'skills'>('occupations');
  const [escoOccRows, setEscoOccRows]       = useState<EscoOccRow[]>([]);
  const [escoSkillRows, setEscoSkillRows]   = useState<EscoSkillRow[]>([]);
  const [escoTotal, setEscoTotal]           = useState(0);
  const [escoGroups, setEscoGroups]         = useState<string[]>([]);
  const [escoLastUpload, setEscoLastUpload] = useState<EscoUpload | null>(null);
  const [escoStats, setEscoStats]           = useState<{ occupations: number; skills: number } | null>(null);
  const [escoGroupFilter, setEscoGroupFilter] = useState('');
  const [escoSearch, setEscoSearch]         = useState('');
  const [escoPage, setEscoPage]             = useState(0);
  const ESCO_PAGE_SIZE = 50;

  // TSC/CCS tab state
  type TscCcsRow = { id: number; sector: string; track: string | null; job_role: string; skill_title: string; skill_type: string | null; proficiency_level: string | null; skill_code: string | null };
  const [tscFile, setTscFile] = useState<File | null>(null);
  const [tscUploading, setTscUploading] = useState(false);
  const [tscRows, setTscRows] = useState<TscCcsRow[]>([]);
  const [tscTotal, setTscTotal] = useState(0);
  const [tscTracks, setTscTracks] = useState<string[]>([]);
  const [tscLastUpload, setTscLastUpload] = useState<CatalogUpload | null>(null);
  const [tscTrackFilter, setTscTrackFilter] = useState('');
  const [tscTypeFilter, setTscTypeFilter] = useState('');
  const [tscSearch, setTscSearch] = useState('');
  const [tscPage, setTscPage] = useState(0);
  const TSC_PAGE_SIZE = 50;

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => setMessage(''), type === 'error' ? 30000 : 6000);
  };

  const loadIndustries = useCallback(async () => {
    const res = await fetch('/api/industries');
    const { data } = await res.json();
    if (data) setIndustries(data);
  }, []);

  const loadLastSync = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sync-ssg');
      const { data } = await res.json();
      if (data?.metadata) {
        const meta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
        setLastSync({ meta, at: data.created_at });
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { loadIndustries(); loadLastSync(); }, [loadIndustries, loadLastSync]);

  useEffect(() => {
    if (!selectedIndustry) { setJobRoles([]); return; }
    fetch(`/api/job-roles?industry_id=${selectedIndustry}`)
      .then(r => r.json())
      .then(({ data }) => { if (data) setJobRoles(data); });
  }, [selectedIndustry]);

  async function initDb() {
    setLoading(true);
    const res = await fetch('/api/admin/init-db', { method: 'POST' });
    const { data, error } = await res.json();
    showMsg(error || data?.message || 'Done', error ? 'error' : 'success');
    setLoading(false);
  }

  async function seedData() {
    setLoading(true);
    const res = await fetch('/api/admin/seed', { method: 'POST' });
    const { data, error } = await res.json();
    showMsg(error || data?.message || 'Done', error ? 'error' : 'success');
    if (!error) loadIndustries();
    setLoading(false);
  }

  async function addIndustry(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/industries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIndustry),
    });
    const { data, error } = await res.json();
    if (error) showMsg(error, 'error');
    else {
      setIndustries(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewIndustry({ name: '', description: '' });
      showMsg('Sector added!');
    }
  }

  async function deleteIndustry(id: number) {
    if (!confirm('Delete this sector and all its job roles?')) return;
    await fetch(`/api/industries?id=${id}`, { method: 'DELETE' });
    setIndustries(prev => prev.filter(i => i.id !== id));
    showMsg('Sector deleted');
  }

  async function addJobRole(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIndustry) return;
    const keywords = newRole.skill_keywords.split(',').map(s => s.trim()).filter(Boolean);
    const res = await fetch('/api/job-roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRole, industry_id: selectedIndustry, skill_keywords: keywords }),
    });
    const { data, error } = await res.json();
    if (error) showMsg(error, 'error');
    else {
      setJobRoles(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRole({ name: '', description: '', skill_keywords: '' });
      showMsg('Job role added!');
    }
  }

  async function deleteJobRole(id: number) {
    await fetch(`/api/job-roles?id=${id}`, { method: 'DELETE' });
    setJobRoles(prev => prev.filter(r => r.id !== id));
    showMsg('Job role deleted');
  }

  const loadCatalog = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(CATALOG_PAGE_SIZE),
      offset: String(catalogPage * CATALOG_PAGE_SIZE),
    });
    if (catalogSectorFilter) params.set('sector', catalogSectorFilter);
    if (catalogSearch) params.set('q', catalogSearch);
    const res = await fetch(`/api/admin/job-catalog?${params}`);
    const { data } = await res.json();
    if (data) {
      setCatalogRows(data.rows);
      setCatalogTotal(data.total);
      setCatalogSectors(data.sectors);
      setCatalogLastUpload(data.lastUpload);
    }
  }, [catalogPage, catalogSectorFilter, catalogSearch]);

  useEffect(() => { if (tab === 'catalog') loadCatalog(); }, [tab, loadCatalog]);

  async function uploadCatalog(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogFile) return;
    if (!confirm('This will REPLACE the entire job role catalog with the contents of this file. Continue?')) return;
    setCatalogUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', catalogFile);
      const res = await fetch('/api/admin/job-catalog/upload', { method: 'POST', body: formData });
      const { data, error } = await res.json();
      if (error) {
        showMsg(error, 'error');
      } else {
        showMsg(data.message, 'success');
        setCatalogFile(null);
        setCatalogPage(0);
        loadCatalog();
      }
    } catch (err) {
      showMsg('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setCatalogUploading(false);
    }
  }

  const loadMapping = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(MAPPING_PAGE_SIZE),
      offset: String(mappingPage * MAPPING_PAGE_SIZE),
    });
    if (mappingSectorFilter) params.set('sector', mappingSectorFilter);
    if (mappingSearch) params.set('q', mappingSearch);
    const res = await fetch(`/api/admin/jobs-skills-mapping?${params}`);
    const { data } = await res.json();
    if (data) {
      setMappingRows(data.rows);
      setMappingTotal(data.total);
      setMappingSectors(data.sectors);
      setMappingLastUpload(data.lastUpload);
    }
  }, [mappingPage, mappingSectorFilter, mappingSearch]);

  useEffect(() => { if (tab === 'skills-mapping') loadMapping(); }, [tab, loadMapping]);

  async function uploadMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!mappingFile) return;
    if (!confirm('This will REPLACE the entire jobs & skills mapping with the contents of this file. Continue?')) return;
    setMappingUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', mappingFile);
      const res = await fetch('/api/admin/jobs-skills-mapping/upload', { method: 'POST', body: formData });
      const { data, error } = await res.json();
      if (error) {
        showMsg(error, 'error');
      } else {
        showMsg(data.message, 'success');
        setMappingFile(null);
        setMappingPage(0);
        loadMapping();
      }
    } catch (err) {
      showMsg('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setMappingUploading(false);
    }
  }

  const loadTscCcs = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(TSC_PAGE_SIZE), offset: String(tscPage * TSC_PAGE_SIZE) });
    if (tscTrackFilter) params.set('track', tscTrackFilter);
    if (tscTypeFilter) params.set('type', tscTypeFilter);
    if (tscSearch) params.set('q', tscSearch);
    const res = await fetch(`/api/admin/tsc-ccs?${params}`);
    const { data } = await res.json();
    if (data) {
      setTscRows(data.rows);
      setTscTotal(data.total);
      setTscTracks(data.tracks);
      setTscLastUpload(data.lastUpload);
    }
  }, [tscPage, tscTrackFilter, tscTypeFilter, tscSearch]);

  useEffect(() => { if (tab === 'tsc-ccs') loadTscCcs(); }, [tab, loadTscCcs]);

  async function uploadTscCcs(e: React.FormEvent) {
    e.preventDefault();
    if (!tscFile) return;
    setTscUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', tscFile);
      const res = await fetch('/api/admin/tsc-ccs/upload', { method: 'POST', body: formData });
      const { data, error } = await res.json();
      if (error) {
        showMsg(error, 'error');
      } else {
        showMsg(data.message, 'success');
        setTscFile(null);
        setTscPage(0);
        loadTscCcs();
      }
    } catch (err) {
      showMsg('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setTscUploading(false);
    }
  }

  const loadEsco = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(ESCO_PAGE_SIZE), offset: String(escoPage * ESCO_PAGE_SIZE), view: escoView });
    if (escoGroupFilter) params.set('group', escoGroupFilter);
    if (escoSearch) params.set('q', escoSearch);
    const res = await fetch(`/api/admin/esco?${params}`);
    const { data } = await res.json();
    if (data) {
      setEscoOccRows(escoView === 'occupations' ? data.rows : []);
      setEscoSkillRows(escoView === 'skills' ? data.rows : []);
      setEscoTotal(data.total);
      setEscoGroups(data.groups);
      setEscoLastUpload(data.lastUpload);
      setEscoStats(data.stats);
    }
  }, [escoPage, escoView, escoGroupFilter, escoSearch]);

  useEffect(() => { if (tab === 'overview' || tab === 'esco') loadEsco(); }, [tab, loadEsco]);

  async function uploadEsco(e: React.FormEvent) {
    e.preventDefault();
    if (!escoFile) return;
    if (!confirm('This will REPLACE all existing ESCO data with the contents of this file. Continue?')) return;
    setEscoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', escoFile);
      const res = await fetch('/api/admin/esco/upload', { method: 'POST', body: formData });
      const { data, error } = await res.json();
      if (error) showMsg(error, 'error');
      else {
        showMsg(data.message, 'success');
        setEscoFile(null);
        setEscoPage(0);
        loadEsco();
      }
    } catch (err) {
      showMsg('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setEscoUploading(false);
    }
  }

  async function clearEsco() {
    if (!confirm('Delete ALL ESCO data? This cannot be undone.')) return;
    const res = await fetch('/api/admin/esco/clear', { method: 'DELETE' });
    const { data, error } = await res.json();
    showMsg(error || data?.message || 'Cleared', error ? 'error' : 'success');
    if (!error) loadEsco();
  }

  // Fetch ESCO data directly from the browser (avoids EU API rate-limiting Vercel's server IPs)
  async function fetchEsco(mode: 'occupations' | 'skills' | 'all') {
    const labels: Record<string, string> = { occupations: 'occupations', skills: 'skills & competences', all: 'occupations + skills' };
    if (!confirm(`This will fetch all ESCO ${labels[mode]} from the EU API and replace existing data. This may take 1–3 minutes. Continue?`)) return;

    const ESCO = 'https://ec.europa.eu/esco/api';
    const PAGE = 100;

    setEscoFetching(mode);
    setMsgType('success');

    try {
      type OccItem   = { title: string; description?: string | null; uri?: string | null; iscoCode?: string | null; iscoLabel?: string | null };
      type SkillItem = { title: string; uri?: string | null };

      // ── Helper: fetch all pages via HAL _links.next ───────────────────
      type EscoItem = { preferredLabel: string; uri: string; description?: string; iscoGroup?: { code?: string; preferredLabel?: string } };
      async function fetchAllPages(url: string, label: string): Promise<EscoItem[]> {
        const all: EscoItem[] = [];
        let nextUrl: string | null = `${url}&limit=${PAGE}&offset=0`;
        let total = 0;
        let page = 0;
        while (nextUrl && page < 200) {
          const currentUrl: string = nextUrl;
          const res = await fetch(currentUrl);
          if (!res.ok) break;
          const json = await res.json();
          if (page === 0) total = Number(json.total ?? 0);
          const results: EscoItem[] = json._embedded?.results ?? [];
          all.push(...results);
          page++;
          // Follow HAL next link; fall back to offset if no next link
          const halNext: string | undefined = json._links?.next?.href;
          nextUrl = halNext ?? (results.length === PAGE ? `${url}&limit=${PAGE}&offset=${page * PAGE}` : null);
          if (nextUrl) {
            setMessage(`⏳ Fetching ${label}… ${all.length} / ${total}`);
            await new Promise(r => setTimeout(r, 120));
          }
        }
        return all;
      }

      let occupations: OccItem[]   = [];
      let skills:      SkillItem[] = [];

      // ── Helper: save a chunk to server ─────────────────────────────────
      async function saveChunk(payload: { occupations?: OccItem[]; skills?: SkillItem[]; append?: boolean }) {
        const r = await fetch('/api/admin/esco/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const { error } = await r.json();
        if (error) throw new Error(error);
      }

      if (mode === 'occupations' || mode === 'all') {
        setMessage('⏳ Fetching ESCO occupations from EU API…');
        const raw = await fetchAllPages(`${ESCO}/search?type=occupation&language=en`, 'occupations');
        // Skip descriptions — too large; only send title + identifiers
        occupations = raw.map(r => ({
          title:     r.preferredLabel,
          uri:       r.uri,
          iscoCode:  r.iscoGroup?.code ?? null,
          iscoLabel: r.iscoGroup?.preferredLabel ?? null,
        }));
        setMessage(`⏳ Got ${occupations.length} occupations. Saving…`);
        await saveChunk({ occupations });
        setMessage(`⏳ Saved ${occupations.length} occupations.${mode === 'all' ? ' Now fetching skills…' : ''}`);
      }

      if (mode === 'skills' || mode === 'all') {
        const raw = await fetchAllPages(`${ESCO}/search?type=skill&language=en`, 'skills');
        skills = raw.map(r => ({ title: r.preferredLabel, uri: r.uri }));
        // Send skills in chunks of 5 000 to stay well under Vercel's body limit
        const CHUNK = 5000;
        for (let i = 0; i < skills.length; i += CHUNK) {
          setMessage(`⏳ Saving skills… ${Math.min(i + CHUNK, skills.length)} / ${skills.length}`);
          await saveChunk({ skills: skills.slice(i, i + CHUNK), append: i > 0 });
        }
      }

      showMsg(`✅ Imported ${occupations.length} occupations and ${skills.length} skills.`, 'success');
      loadEsco();

    } catch (err) {
      showMsg('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
    } finally {
      setEscoFetching(null);
    }
  }

  const [escoSkillSyncing, setEscoSkillSyncing]         = useState(false);
  const [escoSkillSyncProgress, setEscoSkillSyncProgress] = useState('');

  async function syncEscoSkills() {
    if (!confirm(
      'This fetches essential skills for every ESCO occupation from the EU API and stores them locally.\n\n' +
      '~2,900 occupations, takes around 10 minutes. Only needs to be done once (or when ESCO releases a new version).\n\n' +
      'Make sure you have run "Auto-Import from ESCO" first so occupations are loaded. Continue?'
    )) return;

    setEscoSkillSyncing(true);
    setEscoSkillSyncProgress('Loading occupation list…');

    try {
      // 1. Collect all occupations with URIs from our DB
      const allOccs: Array<{ occupation_title: string; isco_group: string; esco_uri: string }> = [];
      let offset = 0;
      while (true) {
        const res  = await fetch(`/api/admin/esco?view=occupations&limit=200&offset=${offset}`);
        const { data } = await res.json() as { data: { rows: Array<{ occupation_title: string; isco_group: string; esco_uri: string | null }> } | null };
        if (!data?.rows?.length) break;
        for (const r of data.rows) if (r.esco_uri) allOccs.push(r as typeof allOccs[0]);
        if (data.rows.length < 200) break;
        offset += 200;
      }

      if (allOccs.length === 0) {
        showMsg('No ESCO occupations found. Run Auto-Import from ESCO first.', 'error');
        return;
      }

      let processed   = 0;
      let totalSkills = 0;
      let clearFirst  = true;
      let batch: Array<{ occupation_title: string; isco_group: string; skills: Array<{ title: string; uri: string; skill_type: string }> }> = [];

      const saveBatch = async () => {
        if (batch.length === 0) return;
        const r = await fetch('/api/admin/esco/sync-skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings: batch, clearFirst }),
        });
        const { data: d } = await r.json() as { data: { inserted: number } | null };
        totalSkills += d?.inserted ?? 0;
        clearFirst   = false;
        batch        = [];
      };

      for (const occ of allOccs) {
        try {
          const r = await fetch(
            `https://ec.europa.eu/esco/api/resource/occupation?uri=${encodeURIComponent(occ.esco_uri)}&language=en`
          );
          if (r.ok) {
            const json = await r.json() as { hasEssentialSkill?: Array<{ preferredLabel: string; uri: string }> };
            const skills = (json.hasEssentialSkill ?? []).map(s => ({
              title: s.preferredLabel, uri: s.uri, skill_type: 'essential',
            }));
            if (skills.length > 0) batch.push({ occupation_title: occ.occupation_title, isco_group: occ.isco_group, skills });
          }
        } catch { /* skip this occupation */ }

        processed++;
        setEscoSkillSyncProgress(`⏳ ${processed} / ${allOccs.length} occupations processed — ${totalSkills} skills stored so far`);
        if (batch.length >= 20) await saveBatch();
        await new Promise(r => setTimeout(r, 80));
      }

      await saveBatch();
      setEscoSkillSyncProgress('');
      showMsg(`✅ ESCO skills synced — ${processed} occupations, ${totalSkills} skill mappings stored.`, 'success');
      loadEsco();
    } catch (err) {
      showMsg('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown'), 'error');
      setEscoSkillSyncProgress('');
    } finally {
      setEscoSkillSyncing(false);
    }
  }

  const [syncSuccess, setSyncSuccess] = useState(false);
  type SkillEntry = { status: number; ok: boolean; snippet: string; error?: string };
  const [ssgDiag, setSsgDiag] = useState<{ hasCredentials: boolean; hasToken: boolean; tokenStatus: number; tokenError?: string; skillResults: Record<string, SkillEntry> } | null>(null);

  async function testSsgConnection() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/test-ssg');
      const { data, error } = await res.json();
      if (error) showMsg(error, 'error');
      else setSsgDiag(data);
    } catch (e) {
      showMsg('Test failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function syncSsg() {
    setLoading(true);
    setSyncSuccess(false);
    showMsg('Syncing from SSG Skills Framework API… this may take up to 30 seconds.', 'success');
    try {
      const res = await fetch('/api/admin/sync-ssg', { method: 'POST' });
      const { data, error } = await res.json();
      if (error) {
        showMsg(error, 'error');
      } else {
        showMsg(data?.message || 'Sync complete!', 'success');
        setSyncSuccess(true);
        loadIndustries();
        loadLastSync();
      }
    } catch (e) {
      showMsg('Sync failed: ' + (e instanceof Error ? e.message : 'Unknown'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>⚙️ Admin Panel</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Manage platform data, sectors, and job roles</p>
      </div>

      {message && (
        <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: msgType === 'success' ? '#f0fdf4' : '#fef2f2', color: msgType === 'success' ? 'var(--success)' : 'var(--danger)' }}>
          {message}
        </div>
      )}

      {/* Back to Overview — shown on all non-overview tabs */}
      {tab !== 'overview' && (
        <button
          onClick={() => setTab('overview')}
          className="flex items-center gap-1.5 mb-6 text-sm font-medium"
          style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ← Admin Panel
        </button>
      )}

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-8">

          {/* ── Section: Data Frameworks ─────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Data Frameworks</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* SSG Card */}
              <div className="card p-5 space-y-4" style={{ border: '2px solid #0078d4', background: '#f0f7ff' }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇸🇬</span>
                  <div>
                    <h3 className="font-bold" style={{ color: '#0078d4' }}>SSG Skills Framework</h3>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Singapore — SkillsFuture</p>
                  </div>
                </div>

                {/* Sync status */}
                {(syncSuccess || lastSync) && (
                  <div className="rounded-lg px-3 py-2 text-sm" style={{ background: syncSuccess ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>
                    ✅ {syncSuccess ? 'Just synced' : `Last synced ${timeAgo(lastSync!.at)}`}
                    {lastSync && <span style={{ color: 'var(--muted)' }}> · {lastSync.meta.totalIndustries} sectors · {lastSync.meta.totalRoles} job roles</span>}
                  </div>
                )}
                {!syncSuccess && !lastSync && (
                  <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--warning)' }}>
                    ⚠️ Never synced — click Sync to pull live data
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={syncSsg} disabled={loading} className="btn-primary text-sm">
                    {loading ? '⏳ Syncing…' : '🔄 Sync Now'}
                  </button>
                  <button onClick={testSsgConnection} disabled={loading} className="btn-secondary text-sm">
                    🔍 Test Connection
                  </button>
                  <button onClick={() => setTab('catalog')} className="btn-secondary text-sm">Manage Data →</button>
                </div>

                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Syncs SubSectors → Sectors and Occupations → Job Roles. Courses are fetched live per search — no sync needed.
                </p>

                {ssgDiag && (
                  <div className="p-3 rounded-lg text-xs font-mono space-y-1.5" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                    <p className="font-semibold text-sm font-sans">Connection Diagnostic</p>
                    <p style={{ color: ssgDiag.hasCredentials ? 'var(--muted)' : 'var(--danger)' }}>
                      Credentials: {ssgDiag.hasCredentials ? '✅ present' : '❌ missing from .env.local'}
                    </p>
                    <p style={{ color: ssgDiag.hasToken ? 'var(--success)' : 'var(--danger)' }}>
                      OAuth token: {ssgDiag.hasToken ? `✅ OK (HTTP ${ssgDiag.tokenStatus})` : `❌ failed (HTTP ${ssgDiag.tokenStatus}) — ${ssgDiag.tokenError ?? 'unknown'}`}
                    </p>
                    {Object.entries(ssgDiag.skillResults).map(([path, r]) => (
                      <div key={path} className="flex items-start gap-2 flex-wrap">
                        <span style={{ color: r.ok ? 'var(--success)' : 'var(--danger)' }}>{r.ok ? '✅' : '❌'}</span>
                        <span style={{ color: 'var(--muted)' }}>{r.status || '---'}</span>
                        <span className="break-all" style={{ color: 'var(--muted)' }}>{path}</span>
                        {r.error && <span style={{ color: 'var(--danger)' }}>— {r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* SSG file upload reference guide */}
                <div className="rounded-lg p-3 space-y-2" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <p className="text-xs font-semibold" style={{ color: '#1e40af' }}>📋 Upload guide — do these in order:</p>
                  <div className="space-y-1.5">
                    {[
                      { num: '1', file: 'jobsandskills-skillsfuture-skills-framework-dataset (Tab 1)', btn: 'Job Role Catalog', table: 'job_role_catalog' },
                      { num: '2', file: 'jobsandskills-skillsfuture-skills-framework-dataset_TSC_CSC', btn: 'TSC/CCS Mapping', table: 'job_role_tsc_ccs' },
                      { num: '3', file: 'jobsandskills-skillsfuture-tsc-to-unique-skills-mapping', btn: 'Skills Mapping', table: 'jobs_skills_mapping' },
                    ].map(r => (
                      <div key={r.num} className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center font-bold text-white" style={{ background: '#2563eb', fontSize: '0.6rem' }}>{r.num}</span>
                        <div className="min-w-0">
                          <span className="font-mono" style={{ color: '#1e3a8a', wordBreak: 'break-all' }}>{r.file}</span>
                          <span style={{ color: 'var(--muted)' }}> → </span>
                          <span className="font-semibold" style={{ color: '#1d4ed8' }}>{r.btn}</span>
                          <span style={{ color: 'var(--muted)' }}> → </span>
                          <span className="font-mono" style={{ color: '#64748b' }}>{r.table}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    File 2 looks up sectors from File 1 — upload order matters. Re-uploading any file fully replaces its table (no duplicates).
                  </p>
                </div>

                {/* SSG sub-tabs quick links */}
                <div className="pt-1 border-t grid grid-cols-3 gap-2" style={{ borderColor: '#bfdbfe' }}>
                  {[
                    { label: 'Job Role Catalog', id: 'catalog' as Tab },
                    { label: 'TSC/CCS Mapping', id: 'tsc-ccs' as Tab },
                    { label: 'Skills Mapping', id: 'skills-mapping' as Tab },
                  ].map(l => (
                    <button key={l.id} onClick={() => setTab(l.id)} className="text-xs px-2 py-2 rounded-lg text-center transition-colors" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ESCO Card */}
              <div className="card p-5 space-y-4" style={{ border: '2px solid #003399', background: '#E8F0FE' }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇪🇺</span>
                  <div>
                    <h3 className="font-bold" style={{ color: '#003399' }}>ESCO Framework</h3>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>European Union — ILO / EU Commission</p>
                  </div>
                </div>

                {!escoFetching && escoStats && (escoStats.occupations > 0 || escoStats.skills > 0) ? (
                  <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>
                    ✅ Data loaded · {escoStats.occupations} occupations · {escoStats.skills} skills
                  </div>
                ) : escoFetching ? null : (
                  <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--warning)' }}>
                    ⚠️ No ESCO data yet — click Auto-Import to fetch from the EU API
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => fetchEsco('all')} disabled={!!escoFetching} className="btn-primary text-sm" style={{ background: '#003399', borderColor: '#003399', opacity: escoFetching ? 0.6 : 1 }}>
                    {escoFetching ? '⏳ Fetching…' : '🌐 Auto-Import from ESCO'}
                  </button>
                  <button onClick={() => setTab('esco')} className="btn-secondary text-sm">Manage →</button>
                </div>

                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Upload occupations and skills from the ESCO CSV download (esco.ec.europa.eu). Stored separately from SSG data.
                </p>

                {!escoFetching && escoStats && (escoStats.occupations > 0) && (
                  <div className="pt-1 border-t grid grid-cols-2 gap-2" style={{ borderColor: '#c7d2fe' }}>
                    {[
                      { label: `${escoStats.occupations} Occupations`, color: '#1d4ed8', bg: '#dbeafe' },
                      { label: `${escoStats.skills} Skills`, color: '#15803d', bg: '#dcfce7' },
                    ].map(s => (
                      <div key={s.label} className="text-xs px-3 py-2 rounded-lg text-center font-semibold" style={{ background: s.bg, color: s.color }}>{s.label}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Section: Non-SSG Data ───────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>Non-SSG Data (Custom)</p>
            <div className="card p-4 mb-4 text-sm space-y-1" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
              <p><strong style={{ color: 'var(--foreground)' }}>Non-SSG Data</strong> = custom sectors and job roles you add manually, for anything <em>not</em> in the Singapore government&apos;s database. For example, if you wanted to add a niche industry or a job role that SSG doesn&apos;t cover, you&apos;d add it here manually instead of syncing it.</p>
              <p>In practice, if you&apos;re fully relying on SSG sync + the Job Role Catalog upload, you probably never need this section at all. It&apos;s a fallback for manual custom data.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏭</span>
                  <div>
                    <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>Sectors</h4>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Add or remove custom industry sectors not from SSG.</p>
                  </div>
                </div>
                <button onClick={() => setTab('industries')} className="btn-secondary text-sm w-full">Manage Sectors →</button>
              </div>
              <div className="card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👔</span>
                  <div>
                    <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>Job Roles</h4>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Add or remove custom job roles linked to your sectors.</p>
                  </div>
                </div>
                <button onClick={() => setTab('job-roles')} className="btn-secondary text-sm w-full">Manage Job Roles →</button>
              </div>
            </div>
          </div>

          {/* ── Section: System Tools ────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>System Tools</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Database */}
              <div className="card p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#f1f5f9' }}>🗄️</div>
                <div>
                  <h4 className="font-semibold" style={{ color: 'var(--foreground)' }}>Database Schema</h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Run once during setup or after a schema change to initialise all tables.</p>
                </div>
                <button onClick={initDb} disabled={loading} className="btn-secondary text-sm w-full">
                  {loading ? 'Running…' : '📋 Initialise Schema'}
                </button>
              </div>

              {/* Quiz Questions */}
              <div className="card p-5 space-y-3" style={{ border: '1.5px solid #ddd6fe' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#f5f3ff' }}>🧠</div>
                <div>
                  <h4 className="font-semibold" style={{ color: '#7c3aed' }}>Quiz Questions</h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Generate 1,000 AI-powered scenario questions per sector. Done once and stored permanently.</p>
                </div>
                <a href="/admin/sector-questions" className="btn-primary text-sm w-full text-center no-underline block" style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                  Open Generator →
                </a>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* Sectors Tab */}
      {tab === 'industries' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Add Sector</h3>
            <form onSubmit={addIndustry} className="space-y-3">
              <input className="input" placeholder="Sector name *" value={newIndustry.name} onChange={e => setNewIndustry(p => ({ ...p, name: e.target.value }))} required />
              <textarea className="input" rows={2} placeholder="Description" value={newIndustry.description} onChange={e => setNewIndustry(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
              <button type="submit" className="btn-primary text-sm">Add Sector</button>
            </form>
          </div>

          <div className="space-y-2">
            {industries.map(ind => (
              <div key={ind.id} className="card p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>{ind.name}</p>
                  {ind.description && <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{ind.description}</p>}
                </div>
                <button onClick={() => deleteIndustry(ind.id)} className="btn-ghost text-sm shrink-0" style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            ))}
            {industries.length === 0 && (
              <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
                <p>No sectors yet. Use the Seed Data button on the Overview tab to populate.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job Roles Tab */}
      {tab === 'job-roles' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Add Job Role</h3>
            <form onSubmit={addJobRole} className="space-y-3">
              <select className="input" value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)} required>
                <option value="">— Select sector —</option>
                {industries.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className="input" placeholder="Job role name *" value={newRole.name} onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))} required />
                <input className="input" placeholder="Key skills (comma separated)" value={newRole.skill_keywords} onChange={e => setNewRole(p => ({ ...p, skill_keywords: e.target.value }))} />
              </div>
              <textarea className="input" rows={2} placeholder="Description" value={newRole.description} onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
              <button type="submit" disabled={!selectedIndustry} className="btn-primary text-sm" style={{ opacity: selectedIndustry ? 1 : 0.5 }}>Add Job Role</button>
            </form>
          </div>

          <div>
            <select className="input mb-4" value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)}>
              <option value="">— Filter by sector —</option>
              {industries.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
            </select>

            <div className="space-y-2">
              {jobRoles.map(role => (
                <div key={role.id} className="card p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>{role.name}</p>
                    {role.description && <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{role.description}</p>}
                    {role.skill_keywords && role.skill_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {role.skill_keywords.map(k => <span key={k} className="badge badge-blue">{k}</span>)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteJobRole(role.id)} className="btn-ghost text-sm shrink-0" style={{ color: 'var(--danger)' }}>Delete</button>
                </div>
              ))}
              {selectedIndustry && jobRoles.length === 0 && (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>No job roles for this sector yet.</p>
              )}
              {!selectedIndustry && (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>Select a sector to view its job roles.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Job Role Catalog Tab */}
      {tab === 'catalog' && (
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>📁 Upload Job Role Catalog</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Upload the master Excel/CSV file (Sector, Track, Job Role, Job Role Description, Performance Expectation).
                Each upload <strong>replaces the entire catalog</strong> — use this for your periodic (monthly / 6-monthly) refresh.
              </p>
            </div>
            <form onSubmit={uploadCatalog} className="flex flex-col sm:flex-row gap-3 items-start">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => setCatalogFile(e.target.files?.[0] ?? null)}
                className="input"
              />
              <button type="submit" disabled={!catalogFile || catalogUploading} className="btn-primary text-sm shrink-0" style={{ opacity: !catalogFile || catalogUploading ? 0.5 : 1 }}>
                {catalogUploading ? 'Uploading…' : '⬆️ Upload & Replace Catalog'}
              </button>
            </form>
            {catalogLastUpload && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Last upload: <strong>{catalogLastUpload.filename || 'file'}</strong> — {catalogLastUpload.row_count} rows
                {catalogLastUpload.skipped_count > 0 && `, ${catalogLastUpload.skipped_count} skipped`} — {timeAgo(catalogLastUpload.created_at)}
              </p>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Browse Catalog ({catalogTotal})</h3>
              <div className="flex flex-wrap gap-2">
                <select
                  className="input text-sm"
                  value={catalogSectorFilter}
                  onChange={e => { setCatalogSectorFilter(e.target.value); setCatalogPage(0); }}
                >
                  <option value="">— All sectors —</option>
                  {catalogSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  className="input text-sm"
                  placeholder="Search job role…"
                  value={catalogSearch}
                  onChange={e => { setCatalogSearch(e.target.value); setCatalogPage(0); }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {catalogRows.map(row => (
                <div key={row.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="badge badge-blue">{row.sector}</span>
                    {row.track && <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.track}</span>}
                  </div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>{row.job_role}</p>
                  {row.job_role_description && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{row.job_role_description}</p>}
                  {row.performance_expectation && (
                    <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}><strong>Performance Expectation:</strong> {row.performance_expectation}</p>
                  )}
                </div>
              ))}
              {catalogRows.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No catalog data yet. Upload a file above to populate it.</p>
              )}
            </div>

            {catalogTotal > CATALOG_PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setCatalogPage(p => Math.max(0, p - 1))}
                  disabled={catalogPage === 0}
                  className="btn-secondary text-sm"
                  style={{ opacity: catalogPage === 0 ? 0.5 : 1 }}
                >
                  ← Previous
                </button>
                <span style={{ color: 'var(--muted)' }}>
                  Page {catalogPage + 1} of {Math.ceil(catalogTotal / CATALOG_PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setCatalogPage(p => p + 1)}
                  disabled={(catalogPage + 1) * CATALOG_PAGE_SIZE >= catalogTotal}
                  className="btn-secondary text-sm"
                  style={{ opacity: (catalogPage + 1) * CATALOG_PAGE_SIZE >= catalogTotal ? 0.5 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TSC/CCS Job Role Mapping Tab */}
      {tab === 'tsc-ccs' && (
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>🏷️ Upload TSC/CCS Job Role Mapping</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Upload the Excel/CSV file with columns: <strong>Track, Job Role, TSC_CCS Title, TSC_CCS Type, Proficiency Level, TSC_CCS Code</strong>.
                Each upload <strong>upserts</strong> — existing rows with matching Job Role + Code are updated; new rows are inserted. Job roles are automatically matched to catalog sectors.
              </p>
            </div>
            <form onSubmit={uploadTscCcs} className="flex flex-col sm:flex-row gap-3 items-start">
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={e => setTscFile(e.target.files?.[0] ?? null)}
                className="input"
              />
              <button type="submit" disabled={!tscFile || tscUploading} className="btn-primary text-sm shrink-0" style={{ opacity: !tscFile || tscUploading ? 0.5 : 1 }}>
                {tscUploading ? 'Uploading…' : '⬆️ Upload & Upsert'}
              </button>
            </form>
            {tscLastUpload && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Last upload: <strong>{tscLastUpload.filename || 'file'}</strong> — {tscLastUpload.row_count} rows — {timeAgo(tscLastUpload.created_at)}
              </p>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Browse TSC/CCS Mapping ({tscTotal})</h3>
              <div className="flex flex-wrap gap-2">
                <select
                  className="input text-sm"
                  value={tscTrackFilter}
                  onChange={e => { setTscTrackFilter(e.target.value); setTscPage(0); }}
                >
                  <option value="">— All tracks —</option>
                  {tscTracks.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  className="input text-sm"
                  value={tscTypeFilter}
                  onChange={e => { setTscTypeFilter(e.target.value); setTscPage(0); }}
                >
                  <option value="">— TSC & CCS —</option>
                  <option value="tsc">TSC only</option>
                  <option value="ccs">CCS only</option>
                </select>
                <input
                  className="input text-sm"
                  placeholder="Search job role or skill…"
                  value={tscSearch}
                  onChange={e => { setTscSearch(e.target.value); setTscPage(0); }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {tscRows.map(row => (
                <div key={row.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {row.track && <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.track}</span>}
                    {row.skill_type && (
                      <span
                        className="badge"
                        style={{
                          background: row.skill_type.toLowerCase() === 'tsc' ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)',
                          color: row.skill_type.toLowerCase() === 'tsc' ? '#2563eb' : '#7c3aed',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        {row.skill_type.toUpperCase()}
                      </span>
                    )}
                    {row.proficiency_level && (
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                        PL {row.proficiency_level}
                      </span>
                    )}
                    {row.skill_code && <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{row.skill_code}</span>}
                  </div>
                  <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{row.job_role}</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{row.skill_title}</p>
                  {row.sector && row.sector !== 'Unknown' && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Sector: {row.sector}</p>
                  )}
                  {row.sector === 'Unknown' && (
                    <p className="text-xs mt-1" style={{ color: 'var(--warning, #d97706)' }}>⚠ Sector not matched — upload catalog first</p>
                  )}
                </div>
              ))}
              {tscRows.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
                  No TSC/CCS data yet. Upload a file above to populate it.<br />
                  <span className="text-xs">Note: data is also auto-populated when you upload the full SSG Job Role Catalog XLSX.</span>
                </p>
              )}
            </div>

            {tscTotal > TSC_PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => setTscPage(p => Math.max(0, p - 1))} disabled={tscPage === 0} className="btn-secondary text-sm" style={{ opacity: tscPage === 0 ? 0.5 : 1 }}>← Previous</button>
                <span style={{ color: 'var(--muted)' }}>Page {tscPage + 1} of {Math.ceil(tscTotal / TSC_PAGE_SIZE)}</span>
                <button onClick={() => setTscPage(p => p + 1)} disabled={(tscPage + 1) * TSC_PAGE_SIZE >= tscTotal} className="btn-secondary text-sm" style={{ opacity: (tscPage + 1) * TSC_PAGE_SIZE >= tscTotal ? 0.5 : 1 }}>Next →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs & Skills Mapping Tab */}
      {tab === 'skills-mapping' && (
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>🧩 Upload Jobs & Skills Mapping</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Upload the SkillsFuture TSC-to-Unique-Skills mapping file (Skill Code, Skill Title, Proficiency Level, Previous/Updated Skill mapping, Sector Tagging, etc.).
                Each upload <strong>replaces the entire mapping table</strong>.
              </p>
            </div>
            <form onSubmit={uploadMapping} className="flex flex-col sm:flex-row gap-3 items-start">
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={e => setMappingFile(e.target.files?.[0] ?? null)}
                className="input"
              />
              <button type="submit" disabled={!mappingFile || mappingUploading} className="btn-primary text-sm shrink-0" style={{ opacity: !mappingFile || mappingUploading ? 0.5 : 1 }}>
                {mappingUploading ? 'Uploading…' : '⬆️ Upload & Replace Mapping'}
              </button>
            </form>
            {mappingLastUpload && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Last upload: <strong>{mappingLastUpload.filename || 'file'}</strong> — {mappingLastUpload.row_count} rows
                {mappingLastUpload.skipped_count > 0 && `, ${mappingLastUpload.skipped_count} skipped`} — {timeAgo(mappingLastUpload.created_at)}
              </p>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Browse Mapping ({mappingTotal})</h3>
              <div className="flex flex-wrap gap-2">
                <select
                  className="input text-sm"
                  value={mappingSectorFilter}
                  onChange={e => { setMappingSectorFilter(e.target.value); setMappingPage(0); }}
                >
                  <option value="">— All sectors —</option>
                  {mappingSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  className="input text-sm"
                  placeholder="Search skill title or code…"
                  value={mappingSearch}
                  onChange={e => { setMappingSearch(e.target.value); setMappingPage(0); }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {mappingRows.map(row => (
                <div key={row.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {row.skill_code && <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.skill_code}</span>}
                    {row.updated_sector_tagging && <span className="badge badge-blue">{row.updated_sector_tagging}</span>}
                    {row.updated_skill_type && <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.updated_skill_type.toUpperCase()}</span>}
                  </div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>{row.updated_skill_title || row.skill_title}</p>
                  {row.skill_desc && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{row.skill_desc}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                    {row.skill_proficiency_level && <span>PL: <strong>{row.skill_proficiency_level}</strong></span>}
                    {row.updated_skill_sfs_status && <span>SFS: <strong>{row.updated_skill_sfs_status}</strong></span>}
                    {row.updated_casl_status && <span>CASL: <strong>{row.updated_casl_status}</strong></span>}
                  </div>
                </div>
              ))}
              {mappingRows.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No mapping data yet. Upload a file above to populate it.</p>
              )}
            </div>

            {mappingTotal > MAPPING_PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setMappingPage(p => Math.max(0, p - 1))}
                  disabled={mappingPage === 0}
                  className="btn-secondary text-sm"
                  style={{ opacity: mappingPage === 0 ? 0.5 : 1 }}
                >
                  ← Previous
                </button>
                <span style={{ color: 'var(--muted)' }}>
                  Page {mappingPage + 1} of {Math.ceil(mappingTotal / MAPPING_PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setMappingPage(p => p + 1)}
                  disabled={(mappingPage + 1) * MAPPING_PAGE_SIZE >= mappingTotal}
                  className="btn-secondary text-sm"
                  style={{ opacity: (mappingPage + 1) * MAPPING_PAGE_SIZE >= mappingTotal ? 0.5 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ESCO TAB ──────────────────────────────────────────────────────── */}
      {tab === 'esco' && (
        <div className="space-y-6">

          {/* Info banner */}
          <div className="card p-5 space-y-2" style={{ border: '2px solid #003399', background: '#E8F0FE' }}>
            <h3 className="font-semibold" style={{ color: '#003399' }}>🇪🇺 ESCO (EU) Job Framework</h3>
            <p className="text-sm" style={{ color: '#1e3a8a' }}>
              ESCO is the European multilingual classification of Skills, Competences and Occupations — the EU equivalent of SSG.
              Download free ESCO data as CSV from <strong>esco.ec.europa.eu/en/use-esco/download</strong>, then fill in the template and upload below.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {['ISCO Groups → Sectors', 'Sub-Groups → Tracks', 'Occupations → Job Roles', 'Skills / Knowledge / Competences'].map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#c7d2fe', color: '#1e40af' }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Stats row */}
          {escoStats && (escoStats.occupations > 0 || escoStats.skills > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Occupations', value: escoStats.occupations, color: '#1d4ed8' },
                { label: 'Skills / Competences', value: escoStats.skills, color: '#15803d' },
                { label: 'ISCO Groups', value: escoGroups.length, color: '#7c3aed' },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Auto-Import card */}
          <div className="card p-5 space-y-4" style={{ border: '2px solid #003399', background: '#f0f4ff' }}>
            <div>
              <h3 className="font-semibold" style={{ color: '#003399' }}>🌐 Auto-Import from ESCO API</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Fetches directly from <strong>esco.ec.europa.eu</strong> — no file download needed. Takes up to 60 seconds. Data is public and free.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { mode: 'occupations' as const, label: '👔 Import Occupations', desc: '~3,000 job roles grouped by ISCO category' },
                { mode: 'skills' as const,      label: '🧩 Import Skills',      desc: '~14,000 skills & competences' },
                { mode: 'all' as const,         label: '⬇ Import All',          desc: 'Occupations + Skills in one go (~60s)' },
              ]).map(({ mode, label, desc }) => (
                <div key={mode} className="rounded-xl p-4 space-y-2" style={{ background: 'white', border: '1px solid #c7d2fe' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{desc}</p>
                  <button
                    onClick={() => fetchEsco(mode)}
                    disabled={!!escoFetching}
                    className="btn-primary text-sm w-full"
                    style={{ background: '#003399', borderColor: '#003399', opacity: escoFetching ? 0.6 : 1 }}
                  >
                    {escoFetching === mode ? '⏳ Fetching…' : label}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sync Skills per Occupation */}
          <div className="card p-5 space-y-3" style={{ border: '2px solid #003399', background: '#f0f4ff' }}>
            <div>
              <h3 className="font-semibold" style={{ color: '#003399' }}>🔗 Sync Skills per Occupation</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Fetches the <strong>essential skills</strong> for each occupation from the EU ESCO API and stores them locally.
                Required for gap analysis to work for non-SG users. Run once after Auto-Import, then again whenever ESCO releases a new version (~annually).
              </p>
            </div>
            {escoSkillSyncProgress && (
              <p className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                {escoSkillSyncProgress}
              </p>
            )}
            <button
              onClick={syncEscoSkills}
              disabled={escoSkillSyncing || !!escoFetching}
              className="btn-primary text-sm w-full"
              style={{ background: '#003399', borderColor: '#003399', opacity: (escoSkillSyncing || !!escoFetching) ? 0.6 : 1 }}
            >
              {escoSkillSyncing ? '⏳ Syncing… (do not close this tab)' : '🔗 Sync Skills per Occupation'}
            </button>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              ⚠️ Takes ~10 minutes for ~2,900 occupations. Keep this tab open.
            </p>
          </div>

          {/* Manual Upload card */}
          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>📁 Manual Upload (Excel / CSV)</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Alternative: fill the template with your own ESCO data and upload. XLSX (2 sheets) or single-sheet CSV.</p>
              </div>
              <a href="/api/admin/esco/template" download className="btn-secondary text-sm">⬇ Download Template</a>
            </div>

            <form onSubmit={uploadEsco} className="flex flex-wrap gap-3 items-end">
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={e => setEscoFile(e.target.files?.[0] ?? null)}
                className="input text-sm flex-1"
              />
              <button
                type="submit"
                disabled={!escoFile || escoUploading}
                className="btn-primary text-sm"
                style={{ opacity: (!escoFile || escoUploading) ? 0.6 : 1 }}
              >
                {escoUploading ? 'Uploading…' : '⬆ Upload'}
              </button>
            </form>

            {escoLastUpload && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Last import: <strong>{escoLastUpload.filename || 'ESCO API'}</strong> — {escoLastUpload.occ_count} occupations, {escoLastUpload.skill_count} skills
                {escoLastUpload.skipped_count > 0 && `, ${escoLastUpload.skipped_count} skipped`} — {timeAgo(escoLastUpload.created_at)}
              </p>
            )}

            {(escoStats?.occupations ?? 0) > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
                <button onClick={clearEsco} className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
                  🗑 Clear all ESCO data
                </button>
              </div>
            )}
          </div>

          {/* Browse */}
          {(escoStats?.occupations ?? 0) > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--muted-bg)' }}>
                  {(['occupations', 'skills'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => { setEscoView(v); setEscoPage(0); }}
                      className="px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize"
                      style={{
                        background: escoView === v ? 'var(--card)' : 'transparent',
                        color: escoView === v ? 'var(--primary)' : 'var(--muted)',
                      }}
                    >
                      {v} {escoView === v && `(${escoTotal})`}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="input text-sm"
                    value={escoGroupFilter}
                    onChange={e => { setEscoGroupFilter(e.target.value); setEscoPage(0); }}
                  >
                    <option value="">— All ISCO groups —</option>
                    {escoGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input
                    className="input text-sm"
                    placeholder={escoView === 'occupations' ? 'Search occupation…' : 'Search skill or occupation…'}
                    value={escoSearch}
                    onChange={e => { setEscoSearch(e.target.value); setEscoPage(0); }}
                  />
                </div>
              </div>

              {/* Occupation rows */}
              {escoView === 'occupations' && (
                <div className="space-y-2">
                  {escoOccRows.map(row => (
                    <div key={row.id} className="card p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="badge badge-blue">{row.isco_group}</span>
                        {row.sub_group && <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.sub_group}</span>}
                      </div>
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{row.occupation_title}</p>
                      {row.occupation_description && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{row.occupation_description.slice(0, 200)}{row.occupation_description.length > 200 ? '…' : ''}</p>}
                      {row.esco_uri && <p className="text-xs mt-1" style={{ color: '#6366f1' }}>{row.esco_uri}</p>}
                    </div>
                  ))}
                  {escoOccRows.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No occupations match.</p>}
                </div>
              )}

              {/* Skill rows */}
              {escoView === 'skills' && (
                <div className="space-y-2">
                  {escoSkillRows.map(row => (
                    <div key={row.id} className="card p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="badge badge-blue">{row.isco_group}</span>
                        <span className="badge" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{row.occupation_title}</span>
                        {row.skill_type && (
                          <span className="badge" style={{ background: row.skill_type === 'knowledge' ? '#fef3c7' : row.skill_type === 'skill' ? '#dcfce7' : '#f5f3ff', color: row.skill_type === 'knowledge' ? '#92400e' : row.skill_type === 'skill' ? '#15803d' : '#6d28d9' }}>
                            {row.skill_type}
                          </span>
                        )}
                      </div>
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{row.skill_title}</p>
                      {row.esco_skill_uri && <p className="text-xs mt-1" style={{ color: '#6366f1' }}>{row.esco_skill_uri}</p>}
                    </div>
                  ))}
                  {escoSkillRows.length === 0 && <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>No skills match.</p>}
                </div>
              )}

              {escoTotal > ESCO_PAGE_SIZE && (
                <div className="flex items-center justify-between text-sm">
                  <button onClick={() => setEscoPage(p => Math.max(0, p - 1))} disabled={escoPage === 0} className="btn-secondary text-sm" style={{ opacity: escoPage === 0 ? 0.5 : 1 }}>← Previous</button>
                  <span style={{ color: 'var(--muted)' }}>Page {escoPage + 1} of {Math.ceil(escoTotal / ESCO_PAGE_SIZE)}</span>
                  <button onClick={() => setEscoPage(p => p + 1)} disabled={(escoPage + 1) * ESCO_PAGE_SIZE >= escoTotal} className="btn-secondary text-sm" style={{ opacity: (escoPage + 1) * ESCO_PAGE_SIZE >= escoTotal ? 0.5 : 1 }}>Next →</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
