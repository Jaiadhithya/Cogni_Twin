/**
 * COGNITWIN: ADVANCED DATA VISUALIZATIONS
 * Using Chart.js to render highly complex and beautiful business data simulations.
 */

// Global Chart configurations for dark theme
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 15, 30, 0.9)';
Chart.defaults.plugins.tooltip.padding = 15;
Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 243, 255, 0.3)';
Chart.defaults.plugins.tooltip.borderWidth = 1;

// Helper to generate random business data
function generateBusinessData(points, min, max) {
    let data = [];
    let current = (max + min) / 2;
    for (let i = 0; i < points; i++) {
        current += (Math.random() - 0.4) * (max - min) * 0.1;
        if (current > max) current = max;
        if (current < min) current = min;
        data.push(current);
    }
    return data;
}

// Generate months labels
const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Digital Twin Accuracy Chart (Radar)
    const radarCtx = document.getElementById('twinRadarChart');
    if(radarCtx) {
        new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: ['Predictive Accuracy', 'Data Sync Latency', 'Anomaly Detection', 'Trend Matching', 'Operational Insight', 'Cost Efficiency'],
                datasets: [{
                    label: 'Traditional Methods',
                    data: [65, 50, 45, 60, 55, 40],
                    backgroundColor: 'rgba(157, 0, 255, 0.2)',
                    borderColor: '#9d00ff',
                    pointBackgroundColor: '#9d00ff'
                }, {
                    label: 'CogniTwin AI',
                    data: [95, 98, 92, 96, 90, 85],
                    backgroundColor: 'rgba(0, 243, 255, 0.4)',
                    borderColor: '#00f3ff',
                    pointBackgroundColor: '#00f3ff',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#00f3ff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { font: { size: 14 } },
                        ticks: { display: false, max: 100, min: 0 }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // 2. Real-Time Business Simulation (Line Chart with Gradient)
    const lineCtx = document.getElementById('simulationLineChart');
    if (lineCtx) {
        const gradientBlue = lineCtx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradientBlue.addColorStop(0, 'rgba(0, 243, 255, 0.8)');
        gradientBlue.addColorStop(1, 'rgba(0, 243, 255, 0.0)');

        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Simulated Revenue Trajectory ($M)',
                    data: generateBusinessData(12, 10, 50),
                    borderColor: '#00f3ff',
                    backgroundColor: gradientBlue,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        beginAtZero: true
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
});
