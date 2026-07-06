import React, { useState } from 'react';
import { API_BASE } from '../config.js';

function FeedbackForm({ requestId, recipientId, foodImage, foodName, onFeedbackSubmitted }) {
  const [comment, setComment] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      setSelectedImage(file);
      setError('');
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim() && !selectedImage) {
      setError('Please provide either a comment or an image');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('request_id', requestId);
      formData.append('recipient_id', recipientId);
      formData.append('comment', comment);
      formData.append('food_name', foodName);
      
      if (selectedImage) {
        formData.append('feedback_image', selectedImage);
      }

      const response = await fetch(`${API_BASE}/submit_feedback.php`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setIsSubmitted(true);
        setComment('');
        setSelectedImage(null);
        setImagePreview(null);
        
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted();
        }
        setTimeout(() => setIsSubmitted(false), 3000);
      } else {
        setError(data.message || 'Failed to submit feedback');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '16px', padding: '16px', border: '1px solid #e9ecef', borderRadius: '8px' }}>
      <h4 style={{ marginBottom: '16px', color: '#28a745' }}>Share Your Feedback</h4>
      
      {foodImage && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ marginBottom: '8px', fontWeight: '500' }}>Food Item: {foodName}</p>
          <img 
            src={foodImage} 
            alt={foodName || 'Donated food'} 
            style={{ 
              maxWidth: '200px', 
              maxHeight: '150px', 
              borderRadius: '8px',
              objectFit: 'cover'
            }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/placeholder-food.jpg';
            }}
          />
        </div>
      )}
      
      {isSubmitted ? (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#d4edda',
          color: '#155724',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px'
        }}>
          <span>✓</span>
          <span>Thank you for your feedback!</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
        
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
              color: '#333',
              fontSize: '14px'
            }}>
              Your Feedback:
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isLoading}
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #ced4da',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '14px',
                resize: 'vertical',
                minHeight: '80px',
                marginBottom: '8px'
              }}
              placeholder="Share your experience with this food donation..."
              required
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
              color: '#333',
              fontSize: '14px'
            }}>
              Add Image (Optional):
            </label>
            
            {!imagePreview ? (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{
                    display: 'none'
                  }}
                  id="feedback-image-input"
                />
                <label
                  htmlFor="feedback-image-input"
                  style={{
                    display: 'block',
                    padding: '0.75rem',
                    border: '2px dashed #28a745',
                    borderRadius: '6px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    color: '#28a745',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(40, 167, 69, 0.05)';
                    e.target.style.borderColor = '#218838';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.borderColor = '#28a745';
                  }}
                >
                  📷 Click to upload an image
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                    Max size: 5MB (JPEG, PNG, GIF, WebP)
                  </div>
                </label>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img
                  src={imagePreview}
                  alt="Feedback preview"
                  style={{
                    width: '100%',
                    maxHeight: '200px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '1px solid #ddd'
                  }}
                />
                <button
                  type="button"
                  onClick={removeImage}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {error && (
            <div style={{ color: '#dc3545', marginBottom: '12px', fontSize: '14px' }}>
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={!comment.trim() && !selectedImage || isLoading}
            style={{
              backgroundColor: (!comment.trim() && !selectedImage) || isLoading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: (!comment.trim() && !selectedImage) || isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {isLoading ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      )}
    </div>
  );
}

export default FeedbackForm;
