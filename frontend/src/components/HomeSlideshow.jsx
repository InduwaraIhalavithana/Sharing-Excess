import { Carousel } from 'react-responsive-carousel';
import 'react-responsive-carousel/lib/styles/carousel.min.css';
import './HomeSlideshow.css';

export default function HomeSlideshow() {
  return (
    <div className="se-slideshow">
      <Carousel
        autoPlay
        infiniteLoop
        showThumbs={false}
        showStatus={false}
        interval={4500}
        dynamicHeight={false}
        swipeable
        emulateTouch
        stopOnHover={false}
        animationHandler="fade"
        transitionTime={600}
      >
        <div className="se-slide">
          <img src="/slideshow/slide5.jpg" alt="Fighting world hunger" />
        </div>
        <div className="se-slide">
          <img src="/slideshow/slide2.jpg" alt="Community food donation" />
        </div>
        <div className="se-slide">
          <img src="/slideshow/slide3.jpg" alt="Fresh produce for redistribution" />
        </div>
      </Carousel>
    </div>
  );
}
