const AnimationHook = {
  mounted() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1
    });

    // Observe all sections except the hero section (which animates immediately)
    const sections = this.el.querySelectorAll('section:not(:first-child)');
    sections.forEach(section => {
      observer.observe(section);
    });
  }
};

export default AnimationHook; 