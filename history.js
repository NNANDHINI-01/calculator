// history.js

// Load calculation history from backend
async function loadHistory() {
    try {
        const resp = await fetch('/api/history');
        const data = await resp.json();
        const historyList = document.getElementById('historyList');

        // if backend returns array only
        if (Array.isArray(data) && data.length > 0) {
            historyList.innerHTML = data.map(item => `
                <div class="history-item">
                    <h4>${escapeHtml(item[0])}</h4>
                    <p><strong>Result:</strong> ${escapeHtml(item[1])}</p>
                </div>
            `).join('');
        }
        // if backend returns wrapped JSON {success, history: [...]}
        else if (data.success && data.history.length > 0) {
            historyList.innerHTML = data.history.map(item => `
                <div class="history-item">
                    <h4>${formatOperationName(item.operation_type)}</h4>
                    <p><strong>Input:</strong> ${escapeHtml(item.input_data)}</p>
                    <p><strong>Result:</strong> ${escapeHtml(item.result)}</p>
                    <p class="timestamp">${new Date(item.created_at).toLocaleString()}</p>
                </div>
            `).join('');
        } 
        else {
            historyList.innerHTML = '<p style="color:#999; text-align:center;">No calculation history yet</p>';
        }
    } catch (err) {
        console.error('Error loading history:', err);
    }
}

// Delete oldest record (FIFO)
document.addEventListener('DOMContentLoaded', function() {
    const deleteOldestBtn = document.getElementById('deleteOldestBtn');
    if (deleteOldestBtn) {
        deleteOldestBtn.addEventListener('click', async function() {
            if (!confirm('Delete the oldest calculation record?')) return;
            try {
                const resp = await fetch('/api/history/oldest', { method: 'DELETE' });
                const data = await resp.json();
                if (data.success) {
                    alert('Oldest record deleted successfully');
                    loadHistory();
                } else {
                    alert(data.message || 'Failed to delete record');
                }
            } catch (err) {
                alert('Error connecting to server');
            }
        });
    }

    // Load history when page loads
    loadHistory();
});

// Convert backend operation keys into readable names
function formatOperationName(operation) {
    const names = {
        'infix_to_postfix': 'Infix to Postfix',
        'infix_to_prefix': 'Infix to Prefix',
        'simple_interest': 'Simple Interest',
        'compound_interest': 'Compound Interest',
        'circle_area': 'Circle Area',
        'rectangle_area': 'Rectangle Area',
        'factorial': 'Factorial',
        'average': 'Average'
    };
    return names[operation] || operation;
}

// Helper to prevent XSS or broken HTML from DB strings
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
