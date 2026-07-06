import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config.js';
import './Donate.css';

function Request() {
  const [formData, setFormData] = useState({
    foodName: '',
    quantity: '',
    neededBy: '',
    location: '',
    listingId: ''
  });
  const [user, setUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (loggedInUser) {
      setUser(JSON.parse(loggedInUser));
    }
  }, []);
  const normalizedRole = (user && user.role ? String(user.role).toLowerCase() : '');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('You must be logged in to submit a request.');
      return;
    }
    if (normalizedRole !== 'recipient') {
      alert('Only recipients can submit requests. You are logged in as ' + (user.role || 'a user') + '.');
      return;
    }

    const payload = {
      recipient_id: user.id,
      food_name: formData.foodName,
      quantity: formData.quantity,
      needed_by: formData.neededBy || null,
      location: formData.location,
      listing_id: formData.listingId ? Number(formData.listingId) : undefined
    };

    try {
      const response = await fetch(`${API_BASE}/request_food.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage('✅ Your request has been submitted.');
        setTimeout(() => setSuccessMessage(''), 5000);
        setFormData({ foodName: '', quantity: '', neededBy: '', location: '', listingId: '' });
      } else {
        setSuccessMessage('');
        alert('Failed to submit request: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      setSuccessMessage('');
      alert('Network error. Please try again.');
    }
  };

  return (
    <div className="donate-page">
      <div className="donate-container">
        <div className="donate-hero">
          <h1 className="donate-hero-title">Request Food</h1>
          <p className="donate-hero-subtitle">
            Tell us what you need, where you need it, and when. We'll help connect you with available donations.
          </p>
        </div>

        {user && normalizedRole === 'recipient' ? (
          <div className="donate-form-container">
            {successMessage && (
              <div className="success-message" style={{
                background: 'linear-gradient(90deg, #28a745 0%, #20c997 100%)',
                color: '#fff',
                padding: '1.2rem',
                borderRadius: '10px',
                marginBottom: '1.5rem',
                textAlign: 'center',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(40, 167, 69, 0.15)'
              }}>
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="donate-form">
              <h2 style={{ color: '#000', textShadow: '2px 2px 8px rgba(255,255,255,0.8)', fontFamily: "'Montserrat', sans-serif", fontSize: '1.8rem', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' }}>
                Food Request Form
              </h2>

              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: '#000' }}>Food Needed *</label>
                  <input
                    type="text"
                    name="foodName"
                    value={formData.foodName}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Rice, Bread, Vegetables"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: '#000' }}>Quantity *</label>
                  <input
                    type="text"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 50 meals, 10 packets"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: '#000' }}>Needed By (Optional)</label>
                  <input
                    type="date"
                    name="neededBy"
                    value={formData.neededBy}
                    onChange={handleChange}
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: '#000' }}>Location *</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    required
                    placeholder="Your address or delivery location"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, color: '#000' }}>Listing ID (Optional)</label>
                <input
                  type="number"
                  name="listingId"
                  value={formData.listingId}
                  onChange={handleChange}
                  placeholder="If requesting a specific listing"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-btn">Submit Request</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="donate-form-container sign-in-required">
            {user ? (
              <>
                <h2 className="sign-in-title">Only recipients can submit requests</h2>
                <p className="sign-in-subtitle">You are logged in as <strong>{user.role}</strong>. Please use the Donate page instead.</p>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                  <a href="/donate" className="submit-btn" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', color: '#fff', textDecoration: 'none', fontFamily: "'Montserrat', sans-serif" }}>
                    Go to Donate
                  </a>
                </div>
              </>
            ) : (
              <>
                <h2 className="sign-in-title">Please sign in to submit a request</h2>
                <p className="sign-in-subtitle">You must be logged in to request food. If you don't have an account, please sign up first.</p>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                  <a href="/" className="submit-btn" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', color: '#fff', textDecoration: 'none', fontFamily: "'Montserrat', sans-serif" }}>
                    Go to Home
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Request;
