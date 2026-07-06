import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiFetch } from '../utils/api.js';
import { API_BASE } from '../config.js';

function FeedbackForm({ requestId, onSuccess, onClose, onFeedbackSubmitted, foodImage, foodName }) {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }
    setSelectedImage(file);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim() && !selectedImage) {
      setError('Please provide a comment or an image');
      return;
    }
    if (!user?.id) {
      setError('You must be logged in to submit feedback');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('request_id', requestId || 0);
      formData.append('recipient_id', user.id);
      formData.append('comment', comment);
      if (foodName) formData.append('food_name', foodName);
      if (selectedImage) formData.append('image', selectedImage);

      const res = await apiFetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setIsSubmitted(true);
        setComment('');
        setSelectedImage(null);
        setImagePreview(null);
        const cb = onSuccess || onFeedbackSubmitted;
        if (cb) cb();
        setTimeout(() => setIsSubmitted(false), 3000);
      } else {
        setError(data.message || 'Failed to submit feedback');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ margin: 0, color: 'var(--clr-primary)' }}>Share Your Feedback</h4>
        {onClose && (
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)' }}>
            ✕
          </button>
        )}
      </div>

      {foodImage && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8, fontWeight: 500 }}>Food Item: {foodName}</p>
          <img src={foodImage} alt={foodName || 'Donated food'}
            style={{ maxWidth: 200, maxHeight: 150, borderRadius: 8, objectFit: 'cover' }}
            onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }} />
        </div>
      )}

      {isSubmitted ? (
        <div style={{ padding: 12, background: '#d4edda', color: '#155724', borderRadius: 4, display: 'flex', gap: 8, fontSize: 14 }}>
          <span>✓</span><span>Thank you for your feedback!</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-primary)', fontSize: 14 }}>
              Your Feedback:
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} disabled={isLoading}
              rows={3}
              style={{ width: '100%', padding: 10, borderRadius: 4, border: '1px solid var(--border)',
                fontFamily: 'inherit', fontSize: 14, resize: 'vertical', minHeight: 80,
                background: 'var(--surface)', color: 'var(--text-primary)' }}
              placeholder="Share your experience with this food donation..." />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: 'var(--text-primary)', fontSize: 14 }}>
              Add Image (Optional):
            </label>
            {!imagePreview ? (
              <>
                <input type="file" accept="image/*" onChange={handleImageChange}
                  style={{ display: 'none' }} id="feedback-image-input" />
                <label htmlFor="feedback-image-input"
                  style={{ display: 'block', padding: '0.75rem', border: '2px dashed var(--clr-primary)',
                    borderRadius: 6, textAlign: 'center', cursor: 'pointer', color: 'var(--clr-primary)',
                    fontWeight: 500 }}>
                  📷 Click to upload an image
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Max size: 5MB (JPEG, PNG, GIF, WebP)
                  </div>
                </label>
              </>
            ) : (
              <div style={{ position: 'relative' }}>
                <img src={imagePreview} alt="Preview"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                <button type="button" onClick={removeImage}
                  style={{ position: 'absolute', top: 8, right: 8, background: '#dc3545', color: '#fff',
                    border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                    fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>
            )}
          </div>

          {error && (
            <div style={{ color: 'var(--clr-danger)', marginBottom: 12, fontSize: 14 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={isLoading}
              style={{ flex: 1, background: isLoading ? '#6c757d' : 'var(--clr-primary)', color: '#fff',
                border: 'none', borderRadius: 4, padding: '8px 16px', fontSize: 14, fontWeight: 500,
                cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading ? 'Submitting…' : 'Submit Feedback'}
            </button>
            {onClose && (
              <button type="button" onClick={onClose}
                style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default FeedbackForm;
