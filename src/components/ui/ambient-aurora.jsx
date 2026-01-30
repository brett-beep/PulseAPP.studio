import React, { useRef, useEffect } from 'react';

const AmbientAurora = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let time = 0;
    let animationFrameId;

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    // Warm color palette: oranges, yellows, salmon pinks, warm whites
    const colors = [
      { r: 255, g: 140, b: 75 },   // Warm Orange
      { r: 255, g: 180, b: 100 },  // Light Orange/Yellow
      { r: 255, g: 200, b: 150 },  // Warm White/Peach
      { r: 255, g: 120, b: 100 },  // Salmon Pink
      { r: 255, g: 160, b: 80 },   // Golden Orange
      { r: 255, g: 220, b: 180 },  // Cream highlight
    ];

    class Orb {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = Math.random() * 350 + 150;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
      }

      draw() {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.25)`);
        gradient.addColorStop(0.5, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.1)`);
        gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      update() {
        this.x += this.vx + Math.sin(time * 0.0008) * 0.4;
        this.y += this.vy + Math.cos(time * 0.0008) * 0.4;

        if (this.x < -this.radius || this.x > canvas.width + this.radius || this.y < -this.radius || this.y > canvas.height + this.radius) {
          this.x = Math.random() * canvas.width;
          this.y = Math.random() * canvas.height;
        }
      }
    }

    let orbs = [];
    for (let i = 0; i < 8; i++) {
      orbs.push(new Orb());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time++;

      orbs.forEach(orb => {
        orb.update();
        orb.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default AmbientAurora;
