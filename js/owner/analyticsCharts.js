/**
 * DynamicRent - Owner Module: Analytics Charts Visualizer (js/owner/analyticsCharts.js)
 * Step 9: Manages responsive Chart.js visualizations in the White + Green SaaS theme.
 */

const AnalyticsCharts = {
  chartInstances: {},

  /**
   * Safely destroy an existing chart instance before re-creating
   * @param {string} canvasId 
   */
  destroyChart(canvasId) {
    if (this.chartInstances[canvasId]) {
      try {
        this.chartInstances[canvasId].destroy();
      } catch (err) {
        console.warn('Failed to destroy chart instance:', err);
      }
      delete this.chartInstances[canvasId];
    }
  },

  /**
   * Render Revenue Over Time Line Chart
   * @param {string} canvasId 
   * @param {Array<{ label: string, revenue: number }>} timelineData 
   */
  renderRevenueTrendChart(canvasId, timelineData) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const ctx = canvas.getContext('2d');
    const labels = timelineData.map(d => d.label);
    const dataPoints = timelineData.map(d => d.revenue);

    // Create subtle green gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(22, 163, 74, 0.28)');
    gradient.addColorStop(1, 'rgba(22, 163, 74, 0.01)');

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Confirmed Revenue (₹)',
          data: dataPoints,
          borderColor: '#16a34a',
          backgroundColor: gradient,
          borderWidth: 2.5,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#15803d',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#17211b',
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '700' },
            bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` Revenue: ₹${item.raw.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Plus Jakarta Sans', size: 11 },
              color: '#64748b',
              callback: (val) => `₹${val.toLocaleString('en-IN')}`
            },
            beginAtZero: true
          }
        }
      }
    });
  },

  /**
   * Render Booking Status Overview Doughnut Chart (Pending vs Confirmed vs Rejected)
   * @param {string} canvasId 
   * @param {{ confirmed: number, pending: number, rejected: number }} statusCounts 
   */
  renderBookingOverviewChart(canvasId, statusCounts) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const ctx = canvas.getContext('2d');
    const total = (statusCounts.confirmed || 0) + (statusCounts.pending || 0) + (statusCounts.rejected || 0);

    if (total === 0) {
      // Empty state
      this.chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['No Bookings'],
          datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          cutout: '72%'
        }
      });
      return;
    }

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Confirmed', 'Pending', 'Rejected'],
        datasets: [{
          data: [statusCounts.confirmed || 0, statusCounts.pending || 0, statusCounts.rejected || 0],
          backgroundColor: ['#16a34a', '#f59e0b', '#ef4444'],
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
              color: '#17211b',
              padding: 14,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: '#17211b',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                const count = item.raw;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return ` ${item.label}: ${count} (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  },

  /**
   * Render Occupancy by Property Vertical Bar Chart
   * @param {string} canvasId 
   * @param {Array<{ name: string, occupancy: number }>} propertyOccupancies 
   */
  renderOccupancyChart(canvasId, propertyOccupancies) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const ctx = canvas.getContext('2d');
    const labels = propertyOccupancies.map(p => p.name.length > 18 ? p.name.substring(0, 16) + '...' : p.name);
    const dataPoints = propertyOccupancies.map(p => p.occupancy);

    // Color bars based on threshold (Green >= 60%, Amber 30-59%, Muted < 30%)
    const backgroundColors = dataPoints.map(val => {
      if (val >= 60) return '#16a34a';
      if (val >= 30) return '#f59e0b';
      return '#94a3b8';
    });

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Occupancy Rate (%)',
          data: dataPoints,
          backgroundColor: backgroundColors,
          borderRadius: 6,
          maxBarThickness: 38
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#17211b',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` Occupancy: ${item.raw}%`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Plus Jakarta Sans', size: 11 },
              color: '#64748b',
              callback: (val) => `${val}%`
            },
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  },

  /**
   * Render Revenue by Property Bar Chart
   * @param {string} canvasId 
   * @param {Array<{ name: string, revenue: number }>} propertyRevenues 
   */
  renderRevenueByPropertyChart(canvasId, propertyRevenues) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const ctx = canvas.getContext('2d');
    const labels = propertyRevenues.map(p => p.name.length > 18 ? p.name.substring(0, 16) + '...' : p.name);
    const dataPoints = propertyRevenues.map(p => p.revenue);

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Confirmed Revenue (₹)',
          data: dataPoints,
          backgroundColor: '#15803d',
          borderRadius: 6,
          maxBarThickness: 38
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#17211b',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` Revenue: ₹${item.raw.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Plus Jakarta Sans', size: 11 },
              color: '#64748b',
              callback: (val) => `₹${val.toLocaleString('en-IN')}`
            },
            beginAtZero: true
          }
        }
      }
    });
  },

  /**
   * Render Historical Price Trend Line Chart for a listing
   * @param {string} canvasId 
   * @param {Array<{ dateStr: string, price: number }>} priceTimeline 
   */
  renderPriceTrendChart(canvasId, priceTimeline) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    this.destroyChart(canvasId);

    const ctx = canvas.getContext('2d');
    const labels = priceTimeline.map(p => p.dateStr);
    const dataPoints = priceTimeline.map(p => p.price);

    this.chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Approved Nightly Rate (₹)',
          data: dataPoints,
          borderColor: '#15803d',
          backgroundColor: 'rgba(21, 128, 61, 0.08)',
          borderWidth: 2.5,
          stepped: 'before', // Stepped line chart shows discrete rate updates
          pointBackgroundColor: '#16a34a',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#17211b',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` Approved Rate: ₹${item.raw.toLocaleString('en-IN')}/night`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Plus Jakarta Sans', size: 11 },
              color: '#64748b',
              callback: (val) => `₹${val.toLocaleString('en-IN')}`
            },
            beginAtZero: false
          }
        }
      }
    });
  }
};
