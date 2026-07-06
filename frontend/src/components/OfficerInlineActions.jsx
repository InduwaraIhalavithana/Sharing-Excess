import React from 'react';
import { API_BASE } from '../config.js';

export function OfficerRequestActions({ request, onDone }) {
  const update = async (updates) => {
    const res = await fetch(`${API_BASE}/officer_update_request.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: request.id, updates })
    }).then(r => r.json());
    if (!res.success) return alert(res.message || 'Update failed');
    onDone && onDone();
  };
  const del = async () => {
    if (!confirm('Delete this request?')) return;
    const res = await fetch(`${API_BASE}/officer_delete_request.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: request.id })
    }).then(r => r.json());
    if (!res.success) return alert(res.message || 'Delete failed');
    onDone && onDone();
  };
  return (
    <span>
      <button onClick={() => { const v = prompt('Status (pending, accepted, declined):', request.status || 'pending'); if (v) update({ status: v }); }}>Set Status</button>
      <button onClick={() => { const v = prompt('Quantity:', request.quantity); if (v!==null) { const n = parseInt(v,10); if (!isNaN(n)) update({ quantity: n }); } }} style={{ marginLeft: 6 }}>Set Qty</button>
      <button onClick={() => { const v = prompt('Notes:', request.notes || ''); if (v!==null) update({ notes: v }); }} style={{ marginLeft: 6 }}>Set Notes</button>
      <button onClick={del} style={{ marginLeft: 6, color: 'red' }}>Delete</button>
    </span>
  );
}

export function OfficerListingActions({ listing, onDone }) {
  const update = async (updates) => {
    const res = await fetch(`${API_BASE}/officer_update_listing.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listing.id, updates })
    }).then(r => r.json());
    if (!res.success) return alert(res.message || 'Update failed');
    onDone && onDone();
  };
  const del = async () => {
    if (!confirm('Delete this listing?')) return;
    const res = await fetch(`${API_BASE}/officer_delete_listing.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listing.id })
    }).then(r => r.json());
    if (!res.success) return alert(res.message || 'Delete failed');
    onDone && onDone();
  };
  return (
    <span>
      <button onClick={() => { const v = prompt('Status (active, inactive, delivered):', listing.status || 'active'); if (v) update({ status: v }); }}>Set Status</button>
      <button onClick={() => { const v = prompt('Quantity:', listing.quantity); if (v!==null) { const n = parseInt(v,10); if (!isNaN(n)) update({ quantity: n }); } }} style={{ marginLeft: 6 }}>Set Qty</button>
      <button onClick={() => { const v = prompt('Title:', listing.title || ''); if (v!==null) update({ title: v }); }} style={{ marginLeft: 6 }}>Set Title</button>
      <button onClick={() => { const v = prompt('Description:', listing.description || ''); if (v!==null) update({ description: v }); }} style={{ marginLeft: 6 }}>Set Desc</button>
      <button onClick={del} style={{ marginLeft: 6, color: 'red' }}>Delete</button>
    </span>
  );
}
