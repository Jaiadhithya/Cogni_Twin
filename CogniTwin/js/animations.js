/**
 * COGNITWIN: ADVANCED GSAP ANIMATIONS
 * Custom staggered entrance and interactive hover effects.
 */

// Load GSAP dynamically
const gsapScript = document.createElement('script');
gsapScript.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js";
document.head.appendChild(gsapScript);

gsapScript.onload = () => {
    // Reveal.js event listeners to trigger animations on slide change
    if (typeof Reveal !== 'undefined') {
        Reveal.on('slidechanged', event => {
            animateSlide(event.currentSlide, event.previousSlide);
        });
        
        // Animate initial slide
        setTimeout(() => {
            if(Reveal.getCurrentSlide()) animateSlide(Reveal.getCurrentSlide());
        }, 500);
    }
};

function animateSlide(currentSlide, previousSlide) {
    if (!currentSlide) return;
    
    // Reset previous slide elements if needed (optional for re-triggering)
    if (previousSlide) {
        gsap.set(previousSlide.querySelectorAll('.glass-panel, h1, h2, h3, p, .feature-card, .ct-list li, .chart-container, pre'), {
            clearProps: "all"
        });
    }
    
    // Define timeline for current slide
    const tl = gsap.timeline();
    
    // Animate Headings
    const headings = currentSlide.querySelectorAll('h1, h2');
    if (headings.length > 0) {
        gsap.fromTo(headings, 
            { y: 50, opacity: 0, scale: 0.95 },
            { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)", stagger: 0.2 }
        );
    }
    
    // Animate Glass Panels
    const panels = currentSlide.querySelectorAll('.glass-panel');
    if (panels.length > 0) {
        gsap.fromTo(panels,
            { y: 100, opacity: 0, rotationX: 10 },
            { y: 0, opacity: 1, rotationX: 0, duration: 1, ease: "power3.out", delay: 0.3 }
        );
    }
    
    // Animate Feature Cards
    const cards = currentSlide.querySelectorAll('.feature-card');
    if (cards.length > 0) {
        gsap.fromTo(cards,
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", stagger: 0.15, delay: 0.5 }
        );
        
        // Add interactive hover animations to cards
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                gsap.to(card, { y: -10, scale: 1.02, duration: 0.3, ease: "power1.out" });
                const icon = card.querySelector('.feature-icon');
                if(icon) gsap.to(icon, { rotation: 15, scale: 1.2, duration: 0.3 });
            });
            card.addEventListener('mouseleave', () => {
                gsap.to(card, { y: 0, scale: 1, duration: 0.3, ease: "power1.out" });
                const icon = card.querySelector('.feature-icon');
                if(icon) gsap.to(icon, { rotation: 0, scale: 1, duration: 0.3 });
            });
        });
    }
    
    // Animate Lists
    const listItems = currentSlide.querySelectorAll('.ct-list li');
    if (listItems.length > 0) {
        gsap.fromTo(listItems,
            { x: -30, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.1, delay: 0.6 }
        );
    }
    
    // Animate Statistics
    const stats = currentSlide.querySelectorAll('.stat-huge');
    if (stats.length > 0) {
        gsap.fromTo(stats,
            { scale: 0, opacity: 0, rotation: -10 },
            { scale: 1, opacity: 1, rotation: 0, duration: 0.8, ease: "elastic.out(1, 0.5)", stagger: 0.2, delay: 0.4 }
        );
    }
    
    // Animate Code Blocks
    const codeBlocks = currentSlide.querySelectorAll('pre');
    if (codeBlocks.length > 0) {
        gsap.fromTo(codeBlocks,
            { x: 50, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.5 }
        );
    }
    
    // Animate Charts
    const charts = currentSlide.querySelectorAll('.chart-container');
    if (charts.length > 0) {
        gsap.fromTo(charts,
            { scale: 0.9, opacity: 0 },
            { scale: 1, opacity: 1, duration: 1, ease: "power2.out", delay: 0.5 }
        );
    }
    
    // Animate Images
    const images = currentSlide.querySelectorAll('.image-wrapper');
    if (images.length > 0) {
        gsap.fromTo(images,
            { opacity: 0, filter: "blur(10px)", scale: 1.1 },
            { opacity: 1, filter: "blur(0px)", scale: 1, duration: 1.2, ease: "power2.out", delay: 0.4 }
        );
    }
    
    // Special Animation for Badges
    const badges = currentSlide.querySelectorAll('.badge');
    if (badges.length > 0) {
        gsap.fromTo(badges,
            { y: -20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, ease: "bounce.out", delay: 0.2 }
        );
    }
}
