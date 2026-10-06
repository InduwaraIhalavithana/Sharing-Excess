import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';
import './Donate.css';
import Toast from './Toast';

const PRESET_AMOUNTS = [6000, 4000, 3500, 3000, 2500, 2000];

export default function Donate() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState('food');
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Food form
  const [food, setFood] = useState({
    foodName: '', quantity: '', expiryDate: '', location: '',
    description: '', contactPhone: '', contactEmail: ''
  });
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Money form
  const [money, setMoney] = useState({
    name: '', email: '', amount: '', phone: '', monthly: true,
  });
  const [moneySuccess, setMoneySuccess] = useState(false);

  // Recently shared listings — shown to signed-out visitors as social proof
  const [recentListings, setRecentListings] = useState([]);
  useEffect(() => {
    if (user) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/listings?limit=4`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.success) setRecentListings(d.listings || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  useEffect(() => {
    if (image) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(image);
    } else {
      setPreview('');
    }
  }, [image]);

  const handleFoodChange = (e) => {
    const { name, value } = e.target;
    setFood(p => ({ ...p, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
    } else {
      showToast('Please select a valid image file.', 'error');
    }
  };

  const handleFoodSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast(t('donate', 'not_logged_in'), 'error');
      window.dispatchEvent(new Event('openLogin'));
      return;
    }
    if (String(user.role || '').toLowerCase() !== 'donor') {
      showToast(t('donate', 'wrong_role'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('donor_id', user.id);
      fd.append('food_name', food.foodName);
      fd.append('quantity', food.quantity);
      fd.append('expiry_date', food.expiryDate);
      fd.append('location', food.location);
      fd.append('description', food.description);
      fd.append('contact_phone', food.contactPhone);
      fd.append('contact_email', food.contactEmail);
      if (image) fd.append('food_image', image);

      const res = await fetch(`${API_BASE}/api/listings`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(t('donate', 'success'));
        setFood({ foodName: '', quantity: '', expiryDate: '', location: '', description: '', contactPhone: '', contactEmail: '' });
        setImage(null);
        setPreview('');
        setTimeout(() => navigate('/donor-dashboard'), 1600);
      } else {
        showToast(data.message || 'Submission failed.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setSubmitting(false);
  };

  const handleMoneyChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMoney(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleMoneySubmit = async (e) => {
    e.preventDefault();
    if (!money.name.trim() || !money.email.trim() || !money.amount) {
      showToast('Please fill in all required fields.', 'error'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/donations/payhere/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: money.name, email: money.email, amount: Number(money.amount), phone: money.phone }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.detail || 'Failed to initiate payment.', 'error');
        setSubmitting(false);
        return;
      }
      // Auto-submit a hidden form to PayHere
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.checkout_url;
      Object.entries(data.params).forEach(([k, v]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch {
      showToast('Network error. Please try again.', 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="donate-page">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* Hero */}
      <div className="donate-hero">
        <div className="container">
          <h1 className="donate-hero__title">{t('donate', 'title')}</h1>
          <p className="donate-hero__sub">{t('donate', 'subtitle')}</p>

          {/* Tab switcher */}
          <div className="donate-tabs">
            <button
              className={`donate-tab${tab === 'food' ? ' active' : ''}`}
              onClick={() => setTab('food')}
            >
              🍱 Donate Food
            </button>
            <button
              className={`donate-tab donate-tab--money${tab === 'money' ? ' active' : ''}`}
              onClick={() => setTab('money')}
            >
              💳 Donate Money
            </button>
          </div>
        </div>
        <div className="donate-hero__wave" aria-hidden="true">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0,20 C480,65 960,5 1440,35 L1440,60 L0,60 Z" fill="var(--bg-base)" />
          </svg>
        </div>
      </div>

      <div className="container donate-body">

        {/* ── Food donation form ── */}
        {tab === 'food' && (
          <>
            {!user && (
              <>
                <div className="donate-gate">
                  <span className="donate-gate__icon" aria-hidden="true">🍱</span>
                  <p className="donate-gate__text">{t('donate', 'not_logged_in')}</p>
                  <p className="donate-gate__sub">
                    Takes under a minute — list your surplus food, an officer verifies it,
                    and a recipient nearby picks it up.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => window.dispatchEvent(new Event('openLogin'))}
                  >
                    Sign In
                  </button>
                </div>

                {/* Impact explainer while signed out */}
                <div className="donate-impact-row">
                  {[
                    { icon: '🥗', title: '1 listing', desc: 'can feed a family for a day' },
                    { icon: '✅', title: 'Every item', desc: 'is safety-checked by a field officer' },
                    { icon: '🚚', title: 'Same-day', desc: 'pickup coordinated for fresh food' },
                    { icon: '📧', title: 'Full tracking', desc: 'email updates from listing to delivery' },
                  ].map(c => (
                    <div key={c.title} className="donate-impact-card card">
                      <span className="donate-impact-card__icon">{c.icon}</span>
                      <strong>{c.title}</strong>
                      <p>{c.desc}</p>
                    </div>
                  ))}
                </div>

                {recentListings.length > 0 && (
                  <div className="donate-recent">
                    <h3 className="donate-recent__title">🌾 Recently shared by donors</h3>
                    <div className="donate-recent__grid">
                      {recentListings.map(l => (
                        <div key={l.id} className="donate-recent-card card">
                          <span className="donate-recent-card__emoji">🍲</span>
                          <div>
                            <strong>{l.food_name}</strong>
                            <p>📦 {l.quantity}{l.location ? ` · 📍 ${l.location}` : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {user && String(user.role || '').toLowerCase() !== 'donor' && (
              <div className="donate-gate donate-gate--warn">
                <p className="donate-gate__text">{t('donate', 'wrong_role')}</p>
              </div>
            )}

            {user && String(user.role || '').toLowerCase() === 'donor' && (
              <div className="donate-food-layout">
              <div className="donate-form-card card">
                {successMsg && (
                  <div className="donate-success">
                    <span>🎉</span> {successMsg}
                  </div>
                )}
                <h2 className="donate-form-card__title">{t('donate', 'title')}</h2>
                <form onSubmit={handleFoodSubmit} noValidate>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">{t('donate', 'food_name')} *</label>
                      <input
                        className="form-control"
                        type="text"
                        name="foodName"
                        value={food.foodName}
                        onChange={handleFoodChange}
                        placeholder={t('donate', 'food_name_placeholder')}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('donate', 'quantity')} *</label>
                      <input
                        className="form-control"
                        type="text"
                        name="quantity"
                        value={food.quantity}
                        onChange={handleFoodChange}
                        placeholder={t('donate', 'quantity_placeholder')}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">{t('donate', 'expiry')} *</label>
                      <input
                        className="form-control"
                        type="date"
                        name="expiryDate"
                        value={food.expiryDate}
                        onChange={handleFoodChange}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('donate', 'location')} *</label>
                      <input
                        className="form-control"
                        type="text"
                        name="location"
                        value={food.location}
                        onChange={handleFoodChange}
                        placeholder={t('donate', 'location_placeholder')}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('donate', 'description')}</label>
                    <textarea
                      className="form-control"
                      name="description"
                      value={food.description}
                      onChange={handleFoodChange}
                      placeholder={t('donate', 'description_placeholder')}
                      rows={3}
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">Contact Phone *</label>
                      <input
                        className="form-control"
                        type="tel"
                        name="contactPhone"
                        value={food.contactPhone}
                        onChange={handleFoodChange}
                        placeholder="+94 77 123 4567"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contact Email *</label>
                      <input
                        className="form-control"
                        type="email"
                        name="contactEmail"
                        value={food.contactEmail}
                        onChange={handleFoodChange}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>

                  {/* Image upload */}
                  <div className="form-group">
                    <label className="form-label">{t('donate', 'image')}</label>
                    <label htmlFor="foodImage" className="donate-img-upload">
                      {preview
                        ? <img src={preview} alt="preview" className="donate-img-preview" />
                        : <span>📷 Click to upload image</span>}
                    </label>
                    <input
                      id="foodImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                    />
                    {preview && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 6, color: 'var(--clr-danger)' }}
                        onClick={() => { setImage(null); setPreview(''); }}
                      >
                        Remove image
                      </button>
                    )}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      disabled={submitting}
                    >
                      {submitting ? 'Listing…' : t('donate', 'submit')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Food sidebar */}
              <aside className="donate-food-sidebar">
                <div className="donate-impact card">
                  <div className="donate-impact__icon">🍽️</div>
                  <h3 className="donate-impact__title">Your Donation Matters</h3>
                  <div className="donate-impact__stats">
                    <div className="donate-impact__stat">
                      <span>1,575+</span>
                      <p>Meals redistributed</p>
                    </div>
                    <div className="donate-impact__stat">
                      <span>50+</span>
                      <p>Active donors</p>
                    </div>
                    <div className="donate-impact__stat">
                      <span>12</span>
                      <p>NGO partners</p>
                    </div>
                  </div>
                </div>

                <div className="donate-tips card">
                  <h3 className="donate-tips__title">Donation Tips</h3>
                  <ul className="donate-tips__list">
                    <li>🕐 List food at least 24 hours before expiry</li>
                    <li>📦 Ensure food is properly sealed/packaged</li>
                    <li>📷 Add a photo to get faster pickups</li>
                    <li>📍 Use a precise pickup address</li>
                    <li>📞 Keep your contact info accurate</li>
                  </ul>
                </div>

                <div className="donate-pledge card">
                  <div className="donate-pledge__icon">🌱</div>
                  <p>"Every listing you create could be a family's next meal."</p>
                </div>
              </aside>
              </div>
            )}
          </>
        )}

        {/* ── Money donation form ── */}
        {tab === 'money' && (
          <div className="donate-money-wrap">
            <div className="donate-money-info card">
              <div className="donate-money-info__icon">🌍</div>
              <h3>Every Rs 4,000 provides 10 meals.</h3>
              <p>Your donation helps rescue surplus food and deliver it to families facing hunger. All food we rescue is donated — we just need to move it. Let's end hunger together.</p>
              <div className="donate-money-badges">
                <span className="badge badge-green">100% Transparent</span>
                <span className="badge badge-green">Sri Lanka Registered</span>
              </div>
              <p className="donate-money-demo-note">Powered by PayHere — Sri Lanka's trusted payment gateway.</p>
            </div>

            <div className="donate-money-form card">
              <div className="donate-money-toggle">
                <button
                  type="button"
                  className={`donate-money-toggle__btn${!money.monthly ? ' active' : ''}`}
                  onClick={() => setMoney(p => ({ ...p, monthly: false }))}
                >
                  Give once
                </button>
                <button
                  type="button"
                  className={`donate-money-toggle__btn${money.monthly ? ' active' : ''}`}
                  onClick={() => setMoney(p => ({ ...p, monthly: true }))}
                >
                  ❤ Monthly
                </button>
              </div>

              <div className="donate-presets">
                {PRESET_AMOUNTS.map(amt => (
                  <button
                    key={amt}
                    type="button"
                    className={`donate-preset${String(money.amount) === String(amt) ? ' active' : ''}`}
                    onClick={() => setMoney(p => ({ ...p, amount: amt }))}
                  >
                    Rs {amt.toLocaleString()}
                  </button>
                ))}
              </div>

              <form onSubmit={handleMoneySubmit} noValidate>
                <div className="form-group">
                  <label className="form-label">Amount (Rs) *</label>
                  <input
                    className="form-control donate-amount-input"
                    type="number"
                    name="amount"
                    value={money.amount}
                    onChange={handleMoneyChange}
                    placeholder="4000"
                    min={1}
                    required
                  />
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Your Name *</label>
                    <input className="form-control" type="text" name="name" value={money.name} onChange={handleMoneyChange} placeholder="Full name" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your Email *</label>
                    <input className="form-control" type="email" name="email" value={money.email} onChange={handleMoneyChange} placeholder="email@example.com" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone (optional)</label>
                  <input className="form-control" type="tel" name="phone" value={money.phone} onChange={handleMoneyChange} placeholder="+94 77 123 4567" />
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                  {submitting ? 'Redirecting to PayHere…' : `Pay with PayHere ${money.monthly ? '(Monthly)' : ''}`}
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 10 }}>
                  You will be redirected to PayHere sandbox to complete your payment securely.
                </p>
              </form>
            </div>
          </div>
        )}

        {/* What We Accept */}
        <div className="donate-accepts">
          <h3 className="donate-accepts__title">What We Accept</h3>
          <div className="donate-accepts__grid">
            {[
              { icon: '✅', title: 'Fresh Food', desc: 'Fruits, vegetables, bread, dairy products' },
              { icon: '✅', title: 'Packaged Food', desc: 'Canned goods, dry foods, snacks' },
              { icon: '✅', title: 'Prepared Meals', desc: 'Leftover food from events, restaurants' },
              { icon: '❌', title: 'Expired Food', desc: 'We cannot accept expired or spoiled food' },
            ].map(item => (
              <div key={item.title} className="donate-accept-item card">
                <span className="donate-accept-item__icon">{item.icon}</span>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
