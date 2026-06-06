import React, { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: number;
}

export const GatewayNetwork: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Node network configuration
    const nodes: Node[] = [];
    const colors = [
      'rgba(6, 182, 212, ',   // Teal
      'rgba(236, 72, 153, ',  // Magenta
      'rgba(139, 92, 246, '   // Purple
    ];

    const maxNodes = Math.min(65, Math.floor((width * height) / 20000)); // Scales with screen size
    const connectionDistance = 140;

    // Initialize nodes
    for (let i = 0; i < maxNodes; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2.5 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        glow: Math.random() * 0.5 + 0.3
      });
    }

    // Canvas animation loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw connections first
      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j];
          const dx = nodeA.x - nodeB.x;
          const dy = nodeA.y - nodeB.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            const opacity = (1 - dist / connectionDistance) * 0.15;
            ctx.beginPath();
            ctx.moveTo(nodeA.x, nodeA.y);
            ctx.lineTo(nodeB.x, nodeB.y);
            // Dynamic gradient between nodes
            const grad = ctx.createLinearGradient(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
            grad.addColorStop(0, nodeA.color + opacity + ')');
            grad.addColorStop(1, nodeB.color + opacity + ')');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // 2. Draw & Update nodes
      nodes.forEach((node) => {
        // Move nodes
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off walls
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Draw node with glow
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        
        ctx.shadowBlur = 12;
        ctx.shadowColor = node.color.replace('rgba', 'rgb').split(',')[0] + ')';
        ctx.fillStyle = node.color + node.glow + ')';
        
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow blur for optimization
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
};
