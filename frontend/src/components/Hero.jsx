import React from 'react';

function Hero() {
  return (
    <section className="hero" style={{ backgroundImage: 'url(/background.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
      <h1>Reduce Food Waste. Feed the Hungry.</h1>
      <p>Connecting donors and NGOs to ensure excess food reaches those who need it most.</p>
      <a href="/donate" className="btn btn-success btn-lg">Donate Now</a>
    </section>
  );
}

export default Hero; 