import { useCallback, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useLanguage } from './i18n/LanguageContext';
import { useMyRequests } from './hooks/queries';
import { api } from './utils/api';
import type { User } from './types/api';
import { imgSrc } from './utils/format';
import NearbyFeed from './components/NearbyFeed';
import NgoEvents from './components/NgoEvents';
import RequestBoard from './components/RequestBoard';
import Toast, { type ToastState } from './components/Toast';
import { StatusBadge } from './components/ui';

type Tab = 'events' | 'requests' | 'food' | 'org';

function Organisation({ user, notify }: { user: User; notify: (m: string, t?: 'success' | 'error') => void }) {
  const { t } = useLanguage();
  const { login } = useAuth();
  const [name, setName] = useState(user.org_name ?? '');
  const [desc, setDesc] = useState(user.org_description ?? '');
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('org_name', name);
      fd.append('org_description', desc);
      if (logo) fd.append('logo', logo);
      const res = await api<{ user: User }>('/api/ngos/me', { method: 'PUT', body: fd });
      login(res.user);
      setLogo(null);
      notify(t('ngo', 'org_saved'));
    } catch (err) {
      notify((err as Error).message, 'error');
    }
    setBusy(false);
  };

  return (
    <form className="dashboard-card pf-form" onSubmit={save}>
      <div className="form-group">
        <label className="form-label" htmlFor="org-name">{t('ngo', 'org_name')}</label>
        <input id="org-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="org-desc">{t('ngo', 'org_desc')}</label>
        <textarea id="org-desc" className="form-control" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} />
      </div>
      <div className="form-group">
        <span className="form-label">{t('ngo', 'logo')}</span>
        <div className="pf-photos">
          {(logo || user.org_logo) && (
            <div className="pf-photo"><img src={logo ? URL.createObjectURL(logo) : imgSrc(user.org_logo)} alt="" /></div>
          )}
          <button type="button" className="pf-photo pf-photo--add" onClick={() => pick.current?.click()}><span>🖼️</span><small>{t('ngo', 'change_logo')}</small></button>
          <input ref={pick} type="file" accept="image/*" hidden aria-label={t('ngo', 'change_logo')} onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <button className="btn btn-primary" type="submit" disabled={busy}>{t('ui', 'save')}</button>
    </form>
  );
}

export default function NgoDashboard() {
  const { t } = useLanguage();
  const { user, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const approved = user?.ngo_status === 'approved';
  const asked = params.get('tab') as Tab | null;
  const tab: Tab = asked && ['events', 'requests', 'food', 'org'].includes(asked) ? asked : approved ? 'events' : 'org';
  const [toast, setToast] = useState<ToastState | null>(null);
  const requestsQ = useMyRequests(!!user && approved);
  const requests = requestsQ.data?.requests ?? [];
  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), []);

  if (!user) return null;
  const tabs: [Tab, string][] = [['events', `📅 ${t('ngo', 'tab_events')}`], ['requests', `📋 ${t('dash', 'my_requests_tab')} (${requests.length})`],
    ['food', `🍽️ ${t('dash', 'nearby_tab')}`], ['org', `🏢 ${t('ngo', 'tab_org')}`]];

  return (
    <div className="dashboard-page">
      {toast && <Toast {...toast} onDone={() => setToast(null)} />}
      <div className="dd-header">
        <div>
          <h1 className="dd-title">{user.org_name ?? user.name}</h1>
          <p className="dd-welcome">{t('ngo', 'dashboard_sub')} {user.district && <>· 📍 {user.district}</>}</p>
          <div className="dd-header__chips"><span className="dd-impact-chip">{t('ngo', 'status')}: <StatusBadge status={user.ngo_status ?? 'pending'} /></span></div>
        </div>
        <Link to="/ngos" className="btn btn-primary">🤝 {t('ngo', 'see_directory')}</Link>
      </div>

      {!approved && (
        <div className="se-notice se-notice--warn">
          {user.ngo_status === 'rejected' ? `❌ ${t('ngo', 'rejected_msg')}` : `⏳ ${t('ngo', 'pending_msg')}`}
          <button className="btn btn-outline btn-sm" onClick={() => refresh()}>↻ {t('ngo', 'check_status')}</button>
        </div>
      )}

      <div className="dd-tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={`dd-tab${tab === k ? ' active' : ''}`} onClick={() => setParams({ tab: k })} disabled={!approved && k !== 'org'}>{label}</button>
        ))}
      </div>

      {tab === 'events' && approved && <NgoEvents ownerId={user.id} notify={notify} />}
      {tab === 'requests' && approved && <RequestBoard requests={requests} notify={notify} emptyText={t('recipient', 'no_requests')} />}
      {tab === 'food' && approved && <NearbyFeed />}
      {tab === 'org' && <Organisation user={user} notify={notify} />}
    </div>
  );
}
