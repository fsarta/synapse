document.addEventListener('DOMContentLoaded', function() {
  const button = document.getElementById('open-dashboard');
  if (button) {
    button.addEventListener('click', function() {
      window.open('https://synapse-dashboard-r6xoeckq4-frasars-projects.vercel.app/', '_blank');
    });
  }
});