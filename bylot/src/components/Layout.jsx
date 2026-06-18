import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

const Layout = ({ children, theme, toggleTheme }) => {
    const navigate = useNavigate();
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    };

    const onTouchMove = (e) => {
        setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    };

    const onTouchEndHandler = () => {
        if (!touchStart || !touchEnd) return;
        
        const distanceX = touchStart.x - touchEnd.x;
        const distanceY = Math.abs(touchStart.y - touchEnd.y);
        
        // Ignore if user scrolled vertically significantly
        if (distanceY > 50) return;
        
        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;
        
        // System gesture: Swipe right from left edge to go back
        if (isRightSwipe && touchStart.x < 40) {
            navigate(-1);
        }
        
        // System gesture: Swipe left from right edge to go forward
        if (isLeftSwipe && touchStart.x > window.innerWidth - 40) {
            navigate(1);
        }
    };

    return (
        <div 
            className="layout"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEndHandler}
        >
            <Header theme={theme} toggleTheme={toggleTheme} />
            <main className="main-content">
                {children}
            </main>
            <Footer />
        </div>
    );
};

export default Layout;
