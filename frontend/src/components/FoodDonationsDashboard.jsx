import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config.js';

function FoodDonationsDashboard() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDonations();
  }, []);

  const fetchDonations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/get_listings.php`);
      const data = await response.json();
      if (data.success) {
        setDonations(data.listings);
      } else {
        setError(data.message || 'Failed to fetch food donations');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="dashboard-container" style={{
      backgroundImage: "url(/background.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      minHeight: "100vh"
    }}>
      <h2 style={{
        color: '#000',
        textShadow: '2px 2px 8px rgba(255,255,255,0.8)',
        fontFamily: "'Montserrat', sans-serif",
        fontSize: '2.5rem',
        fontWeight: '900',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        Food Donations
      </h2>
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <p style={{
          color: '#000',
          textShadow: '1px 1px 6px rgba(255,255,255,0.8)',
          fontFamily: "'Montserrat', sans-serif",
          fontSize: '1.1rem',
          margin: 0
        }}>
          Browse all food donations from our generous donors
        </p>
        <button onClick={fetchDonations} className="refresh-btn" style={{ background: '#28a745', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 16, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", boxShadow: '0 2px 8px rgba(40,167,69,0.15)', cursor: 'pointer' }}>
          <span>🔄</span> Refresh
        </button>
      </div>
      {loading ? (
        <div className="loading" style={{ textAlign: 'center', color: '#000', fontSize: '1.2rem', padding: '40px', fontFamily: "'Montserrat', sans-serif", textShadow: '1px 1px 6px rgba(255,255,255,0.8)' }}>
          Loading food donations...
        </div>
      ) : error ? (
        <div className="error-message" style={{ textAlign: 'center', color: '#dc3545', background: 'rgba(255, 255, 255, 0.9)', padding: '20px', borderRadius: '12px', border: '1px solid #fed7d7', margin: '20px', fontSize: '1.1rem', fontFamily: "'Montserrat', sans-serif" }}>
          {error}
        </div>
      ) : donations.length === 0 ? (
        <div className="no-requests" style={{ background: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)', margin: '20px', padding: '40px', textAlign: 'center', color: '#000', fontFamily: "'Montserrat', sans-serif" }}>
          <p style={{ margin: '10px 0', fontSize: '1.1rem', color: '#000', fontFamily: "'Montserrat', sans-serif" }}>
            No food donations available at the moment.
          </p>
          <p style={{ margin: '10px 0', fontSize: '1.1rem', color: '#000', fontFamily: "'Montserrat', sans-serif" }}>
            Check back later for new donations.
          </p>
        </div>
      ) : (
        <div className="dashboard-listings" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          margin: '0 24px'
        }}>
          {donations.map((donation) => (
            <div key={donation.id} className="dashboard-card" style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 24px rgba(40, 167, 69, 0.10)',
              border: '2px solid #28a745',
              fontFamily: "'Montserrat', sans-serif",
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 300
            }}>
              {donation.image_path && (
                <div style={{ 
                  width: '100%', 
                  height: '180px', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  marginBottom: '1rem',
                  border: '1px solid #e0e0e0'
                }}>
                  <img 
                    src={donation.image_path} 
                    alt={donation.food_name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center'
                    }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/placeholder-food.jpg'; // Fallback image if the original fails to load
                    }}
                  />
                </div>
              )}
              <div className="food-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong className="food-name" style={{ color: '#000', fontFamily: "'Montserrat', sans-serif", fontSize: '1.2rem' }}>{donation.food_name}</strong>
                <span className="quantity-badge" style={{ color: '#28a745', background: 'rgba(40, 167, 69, 0.12)', fontWeight: 700, borderRadius: 8, padding: '4px 12px', fontSize: 15 }}>{donation.quantity}</span>
              </div>
              <div className="food-details" style={{ marginBottom: 12 }}>
                <div className="detail-item"><span className="detail-label" style={{ color: '#000', fontWeight: 600 }}>📅 Expiry:</span> <span className="detail-value" style={{ color: '#000' }}>{donation.expiry_date}</span></div>
                <div className="detail-item"><span className="detail-label" style={{ color: '#000', fontWeight: 600 }}>📍 Location:</span> <span className="detail-value" style={{ color: '#000' }}>{donation.location}</span></div>
                <div className="detail-item"><span className="detail-label" style={{ color: '#000', fontWeight: 600 }}>🗓️ Listed:</span> <span className="detail-value" style={{ color: '#000' }}>{new Date(donation.created_at).toLocaleDateString()}</span></div>
                <div className="detail-item"><span className="detail-label" style={{ color: '#000', fontWeight: 600 }}>👤 Donor:</span> <span className="detail-value" style={{ color: '#000' }}>{donation.donor_name}</span></div>
                {donation.description && <div className="detail-item"><span className="detail-label" style={{ color: '#000', fontWeight: 600 }}>📝 Description:</span> <span className="detail-value" style={{ color: '#000' }}>{donation.description}</span></div>}
                {donation.contact_phone && <div className="detail-item"><span className="detail-label" style={{ color: '#000', fontWeight: 600 }}>📞 Contact:</span> <span className="detail-value" style={{ color: '#000' }}>{donation.contact_phone}</span></div>}
                {donation.contact_email && <div className="detail-item"><span className="detail-label" style={{ color: '#000', fontWeight: 600 }}>✉️ Email:</span> <span className="detail-value" style={{ color: '#000' }}>{donation.contact_email}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FoodDonationsDashboard; 