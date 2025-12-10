(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return;
  }

  const DASHBOARD_BACKGROUNDS = {
    morning: '/dashboard_background_morning.jpg',
    day: '/dashboard_background_day.jpg',
    evening: '/dashboard_background_evening.jpg',
    night: '/dashboard_background_night.jpg',
  };

  const getPhaseFromHour = (hour) => {
    if (hour >= 5 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 16) return 'day';
    if (hour >= 16 && hour < 21) return 'evening';
    return 'night';
  };

  const applyDashboardBackground = () => {
    const hour = new Date().getHours();
    const phase = getPhaseFromHour(hour);
    const assetPath = DASHBOARD_BACKGROUNDS[phase];
    if (!assetPath) return;

    document.body.style.setProperty('--dashboard-bg-image', `url('${assetPath}')`);
    document.body.dataset.dashboardPhase = phase;
  };

  applyDashboardBackground();
  window.setInterval(applyDashboardBackground, 5 * 60 * 1000);
})();
