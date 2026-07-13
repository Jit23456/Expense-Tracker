"use strict";
// FlowExpense frontend — TypeScript source.
// Build with `npm run build` (compiles to static/js/main.js, which the templates load).
// Must match --bg-card-solid in static/css/style.css (doughnut segment gap color)
const CHART_SURFACE = '#171c36';
document.addEventListener('DOMContentLoaded', () => {
    const canDelete = document.body.dataset.canDelete === 'true';
    // DOM Elements
    const expenseForm = document.getElementById('expense-form');
    const titleInput = document.getElementById('title');
    const amountInput = document.getElementById('amount');
    const categorySelect = document.getElementById('category');
    const dateInput = document.getElementById('date');
    const notesInput = document.getElementById('notes');
    const expensesList = document.getElementById('expenses-list');
    const emptyListState = document.getElementById('empty-list-state');
    const searchInput = document.getElementById('search-input');
    const filterCategory = document.getElementById('filter-category');
    const listCountBadge = document.getElementById('list-count-badge');
    const metricTotalSpent = document.getElementById('metric-total-spent');
    const metricTotalCount = document.getElementById('metric-total-count');
    const metricTopCategory = document.getElementById('metric-top-category');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const quickAddBtn = document.getElementById('quick-add-btn');
    let categoryChart = null;
    // Colors validated for CVD separation and contrast on the dark card surface (#171c36)
    const categoryConfig = {
        'Food & Dining': { icon: 'fa-utensils', color: '#d97706', bg: 'rgba(217, 119, 6, 0.15)' },
        'Transportation': { icon: 'fa-car', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
        'Shopping': { icon: 'fa-bag-shopping', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
        'Bills & Utilities': { icon: 'fa-bolt', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
        'Entertainment': { icon: 'fa-gamepad', color: '#0891b2', bg: 'rgba(8, 145, 178, 0.15)' },
        'Healthcare': { icon: 'fa-heart-pulse', color: '#059669', bg: 'rgba(5, 150, 105, 0.15)' },
        'General': { icon: 'fa-coins', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
    };
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    // Quick add scroll focus
    quickAddBtn.addEventListener('click', () => {
        titleInput.focus();
        document.getElementById('form-card')?.scrollIntoView({ behavior: 'smooth' });
    });
    function formatINR(value) {
        return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    // Show Notification Toast
    function showToast(msg, isError = false) {
        toastMessage.textContent = msg;
        toast.style.borderColor = isError ? '#ef4444' : '#6366f1';
        const icon = toast.querySelector('.toast-icon');
        if (icon) {
            icon.className = isError
                ? 'toast-icon fa-solid fa-circle-exclamation'
                : 'toast-icon fa-solid fa-circle-check';
        }
        toast.classList.remove('hidden');
        window.setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
    // Helper to format date header nicely (e.g. Today, Yesterday, Monday, Jun 29, 2026)
    function formatDayHeader(dateStr) {
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (dateStr === todayStr) {
            return 'Today';
        }
        else if (dateStr === yesterdayStr) {
            return 'Yesterday';
        }
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
            return dateObj.toLocaleDateString('en-US', options);
        }
        return dateStr;
    }
    // Load Overview Summary & Chart Data
    async function loadSummary() {
        try {
            const res = await fetch('/api/summary');
            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (!res.ok)
                throw new Error('Failed to load summary.');
            const data = await res.json();
            metricTotalSpent.textContent = formatINR(data.total_spent);
            metricTotalCount.textContent = String(data.total_count);
            metricTopCategory.textContent = data.top_category;
            updateChart(data.category_totals);
        }
        catch (err) {
            console.error('Failed to load summary:', err);
        }
    }
    // Initialize or Update Chart.js Doughnut Chart
    function updateChart(categoryTotals) {
        const canvas = document.getElementById('categoryChart');
        const ctx = canvas.getContext('2d');
        const emptyChartMsg = document.getElementById('chart-empty-state');
        const labels = Object.keys(categoryTotals);
        const dataValues = Object.values(categoryTotals);
        if (labels.length === 0) {
            canvas.style.display = 'none';
            emptyChartMsg.style.display = 'block';
            if (categoryChart) {
                categoryChart.destroy();
                categoryChart = null;
            }
            return;
        }
        canvas.style.display = 'block';
        emptyChartMsg.style.display = 'none';
        const backgroundColors = labels.map(cat => (categoryConfig[cat] ? categoryConfig[cat].color : '#64748b'));
        if (categoryChart) {
            categoryChart.data.labels = labels;
            categoryChart.data.datasets[0].data = dataValues;
            categoryChart.data.datasets[0].backgroundColor = backgroundColors;
            categoryChart.update();
        }
        else {
            categoryChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                            data: dataValues,
                            backgroundColor: backgroundColors,
                            borderWidth: 2,
                            borderColor: CHART_SURFACE,
                            borderRadius: 4,
                            hoverOffset: 8
                        }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: 6 },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#94a3b8',
                                font: { family: 'Inter', size: 12 },
                                padding: 14,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 8,
                                boxHeight: 8
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(7, 8, 17, 0.92)',
                            borderColor: 'rgba(148, 163, 184, 0.2)',
                            borderWidth: 1,
                            padding: 10,
                            cornerRadius: 10,
                            titleFont: { family: 'Inter', weight: '600' },
                            bodyFont: { family: 'Inter' },
                            callbacks: {
                                label: (context) => ` ₹${(Number(context.raw) || 0).toFixed(2)}`
                            }
                        }
                    },
                    cutout: '70%'
                }
            });
        }
    }
    // Load Expenses List
    async function loadExpenses() {
        const cat = filterCategory.value;
        const search = searchInput.value.trim();
        let url = `/api/expenses?category=${encodeURIComponent(cat)}`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }
        try {
            const res = await fetch(url);
            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (!res.ok)
                throw new Error('Failed to load expenses.');
            const expenses = await res.json();
            expensesList.innerHTML = '';
            listCountBadge.textContent = `${expenses.length} item${expenses.length === 1 ? '' : 's'}`;
            if (expenses.length === 0) {
                emptyListState.style.display = 'block';
                return;
            }
            emptyListState.style.display = 'none';
            // Group expenses by date
            const groups = {};
            expenses.forEach(exp => {
                if (!groups[exp.date]) {
                    groups[exp.date] = { items: [], total: 0 };
                }
                groups[exp.date].items.push(exp);
                groups[exp.date].total += exp.amount;
            });
            // Get sorted dates (descending order)
            const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
            sortedDates.forEach(dateStr => {
                const group = groups[dateStr];
                const headerLi = document.createElement('li');
                headerLi.className = 'date-group-header';
                headerLi.innerHTML = `
                    <span class="date-group-title">
                        <i class="fa-regular fa-calendar-check" style="color: var(--primary);"></i>
                        ${formatDayHeader(dateStr)}
                    </span>
                    <span class="date-group-total">${formatINR(group.total)}</span>
                `;
                expensesList.appendChild(headerLi);
                group.items.forEach(exp => {
                    expensesList.appendChild(renderExpenseItem(exp));
                });
            });
        }
        catch (err) {
            console.error('Failed to load expenses:', err);
        }
    }
    // Render single expense item element
    function renderExpenseItem(exp) {
        const conf = categoryConfig[exp.category] || categoryConfig['General'];
        const deleteButton = canDelete
            ? `<button class="btn-delete" title="Delete Expense">
                    <i class="fa-solid fa-trash-can"></i>
               </button>`
            : '';
        const li = document.createElement('li');
        li.className = 'expense-item';
        li.dataset.id = String(exp.id);
        li.style.borderLeft = `3px solid ${conf.color}`;
        li.innerHTML = `
            <div class="expense-left">
                <div class="category-tag-icon" style="background: ${conf.bg}; color: ${conf.color};">
                    <i class="fa-solid ${conf.icon}"></i>
                </div>
                <div class="expense-details">
                    <h4>${escapeHtml(exp.title)}</h4>
                    <div class="expense-meta">
                        <span style="color: ${conf.color}; font-weight: 500;">${exp.category}</span>
                        ${exp.notes ? `<span class="expense-notes">• ${escapeHtml(exp.notes)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="expense-right">
                <span class="expense-amount">${formatINR(exp.amount)}</span>
                ${deleteButton}
            </div>
        `;
        if (canDelete) {
            li.querySelector('.btn-delete')?.addEventListener('click', () => deleteExpense(exp.id, li));
        }
        return li;
    }
    // Helper to escape HTML and prevent XSS
    function escapeHtml(str) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
        return str.replace(/[&<>'"]/g, tag => map[tag] || tag);
    }
    // Add Expense Handler
    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newExpense = {
            title: titleInput.value.trim(),
            amount: parseFloat(amountInput.value),
            category: categorySelect.value,
            date: dateInput.value,
            notes: notesInput.value.trim()
        };
        if (!newExpense.title || isNaN(newExpense.amount)) {
            showToast('Please enter a valid title and amount.', true);
            return;
        }
        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newExpense)
            });
            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (res.ok) {
                showToast('Expense recorded successfully!');
                titleInput.value = '';
                amountInput.value = '';
                notesInput.value = '';
                dateInput.value = today;
                loadExpenses();
                loadSummary();
            }
            else {
                const err = await res.json();
                showToast(err.error || 'Failed to save expense.', true);
            }
        }
        catch {
            showToast('Network error while saving.', true);
        }
    });
    // Delete Expense Handler
    async function deleteExpense(id, element) {
        if (!confirm('Are you sure you want to delete this transaction?'))
            return;
        try {
            const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
            if (res.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (res.status === 403) {
                showToast('Admin access is required to delete expenses.', true);
                return;
            }
            if (res.ok) {
                element.style.transform = 'scale(0.95)';
                element.style.opacity = '0';
                window.setTimeout(() => {
                    element.remove();
                    loadExpenses();
                    loadSummary();
                }, 250);
                showToast('Expense deleted.');
            }
            else {
                showToast('Failed to delete expense.', true);
            }
        }
        catch {
            showToast('Network error while deleting.', true);
        }
    }
    // Real-time Search and Filter Event Listeners
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(loadExpenses, 250);
    });
    filterCategory.addEventListener('change', loadExpenses);
    // Initial load calls
    loadExpenses();
    loadSummary();
});
