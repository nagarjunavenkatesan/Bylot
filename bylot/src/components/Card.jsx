import React from 'react';
import Tilt from 'react-parallax-tilt';
import '../styles/Card.css';

const Card = ({ children, className = '', ...props }) => {
    return (
        <Tilt
            className="card-tilt-wrapper"
            tiltMaxAngleX={10}
            tiltMaxAngleY={10}
            perspective={1000}
            scale={1.02}
            transitionSpeed={800}
            gyroscope={true}
        >
            <div className={`card-inner-3d ${className}`} {...props}>
                {children}
            </div>
        </Tilt>
    );
};

export default Card;
