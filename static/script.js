// Calculator operations - talks to /api/calculate
document.addEventListener('DOMContentLoaded', function() {
    const operationType = document.getElementById('operationType');
    const inputSection = document.getElementById('inputSection');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultBox = document.getElementById('result');

    // Tab buttons (hero tabs) hookup
    document.querySelectorAll('.hero-tabs .tab').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.hero-tabs .tab').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
            const op = this.dataset.op;
            if (op) {
                operationType.value = op;
                operationType.dispatchEvent(new Event('change'));
            }
        });
    });

    operationType.addEventListener('change', function() {
        const operation = this.value;
        inputSection.innerHTML = '';
        resultBox.classList.remove('show');
        resultBox.innerHTML = '';

        if (operation) {
            calculateBtn.style.display = 'block';
            generateInputFields(operation);
        } else {
            calculateBtn.style.display = 'none';
        }
    });

    calculateBtn.addEventListener('click', async function() {
        const operation = operationType.value;
        const inputs = collectInputs(operation);

        if (!validateInputs(operation, inputs)) return;

        try {
            const resp = await fetch('/api/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operation: operation, inputs: inputs })
            });
            const data = await resp.json();
            if (data.success) {
                displayResult(operation, data.result, inputs);
                loadHistory(); // refresh history list
            } else {
                alert('Calculation error: ' + (data.message || 'Unknown'));
            }
        } catch (err) {
            alert('Error connecting to server');
        }
    });

    // generateInputFields, collectInputs, validateInputs, displayResult — same as before
    function generateInputFields(operation) {
        let html = '';
        switch(operation) {
            case 'infix_to_postfix':
            case 'infix_to_prefix':
                html = `
                    <div class="input-group">
                        <label>Infix Expression (e.g., A+B*C or 3+5*2):</label>
                        <input type="text" id="expression" placeholder="Enter infix expression">
                    </div>`;
                break;
            case 'simple_interest':
                html = `
                    <div class="input-group"><label>Principal Amount:</label><input type="number" id="principal" step="0.01" placeholder="Enter principal"></div>
                    <div class="input-group"><label>Rate of Interest (%):</label><input type="number" id="rate" step="0.01" placeholder="Enter rate"></div>
                    <div class="input-group"><label>Time (years):</label><input type="number" id="time" step="0.01" placeholder="Enter time"></div>`;
                break;
            case 'compound_interest':
                html = `
                    <div class="input-group"><label>Principal Amount:</label><input type="number" id="principal" step="0.01" placeholder="Enter principal"></div>
                    <div class="input-group"><label>Rate of Interest (%):</label><input type="number" id="rate" step="0.01" placeholder="Enter rate"></div>
                    <div class="input-group"><label>Time (years):</label><input type="number" id="time" step="0.01" placeholder="Enter time"></div>
                    <div class="input-group"><label>Compounding Frequency (per year):</label><input type="number" id="frequency" placeholder="Enter frequency (e.g., 12)"></div>`;
                break;
            case 'circle_area':
                html = `<div class="input-group"><label>Radius:</label><input type="number" id="radius" step="0.01" placeholder="Enter radius"></div>`;
                break;
            case 'rectangle_area':
                html = `
                    <div class="input-group"><label>Length:</label><input type="number" id="length" step="0.01" placeholder="Enter length"></div>
                    <div class="input-group"><label>Width:</label><input type="number" id="width" step="0.01" placeholder="Enter width"></div>`;
                break;
            case 'factorial':
                html = `<div class="input-group"><label>Number (non-negative integer):</label><input type="number" id="number" placeholder="Enter number"></div>`;
                break;
            case 'average':
                html = `<div class="input-group"><label>Numbers (comma-separated, e.g., 5,10,15):</label><textarea id="numbers" rows="3" placeholder="Enter numbers separated by commas"></textarea></div>`;
                break;
        }
        inputSection.innerHTML = html;
    }

    function collectInputs(operation) {
        const inputs = {};
        switch(operation) {
            case 'infix_to_postfix':
            case 'infix_to_prefix':
                inputs.expression = (document.getElementById('expression') || {value:''}).value.trim();
                break;
            case 'simple_interest':
                inputs.principal = parseFloat(document.getElementById('principal').value);
                inputs.rate = parseFloat(document.getElementById('rate').value);
                inputs.time = parseFloat(document.getElementById('time').value);
                break;
            case 'compound_interest':
                inputs.principal = parseFloat(document.getElementById('principal').value);
                inputs.rate = parseFloat(document.getElementById('rate').value);
                inputs.time = parseFloat(document.getElementById('time').value);
                inputs.frequency = parseInt(document.getElementById('frequency').value);
                break;
            case 'circle_area':
                inputs.radius = parseFloat(document.getElementById('radius').value);
                break;
            case 'rectangle_area':
                inputs.length = parseFloat(document.getElementById('length').value);
                inputs.width = parseFloat(document.getElementById('width').value);
                break;
            case 'factorial':
                inputs.number = parseInt(document.getElementById('number').value);
                break;
            case 'average':
                const numbersStr = (document.getElementById('numbers') || {value:''}).value.trim();
                inputs.numbers = numbersStr.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n));
                break;
        }
        return inputs;
    }

    function validateInputs(operation, inputs) {
        switch(operation) {
            case 'infix_to_postfix':
            case 'infix_to_prefix':
                if (!inputs.expression) { alert('Please enter an expression'); return false; }
                break;
            case 'simple_interest':
            case 'compound_interest':
                if (isNaN(inputs.principal) || isNaN(inputs.rate) || isNaN(inputs.time)) { alert('Please enter valid numbers'); return false; }
                if (operation === 'compound_interest' && isNaN(inputs.frequency)) { alert('Please enter valid frequency'); return false; }
                break;
            case 'circle_area':
                if (isNaN(inputs.radius) || inputs.radius <= 0) { alert('Please enter a valid positive radius'); return false; }
                break;
            case 'rectangle_area':
                if (isNaN(inputs.length) || isNaN(inputs.width) || inputs.length <= 0 || inputs.width <= 0) { alert('Please enter valid positive dimensions'); return false; }
                break;
            case 'factorial':
                if (isNaN(inputs.number) || inputs.number < 0 || !Number.isInteger(inputs.number)) { alert('Please enter a non-negative integer'); return false; }
                break;
            case 'average':
                if (!inputs.numbers || inputs.numbers.length === 0) { alert('Please enter valid numbers'); return false; }
                break;
        }
        return true;
    }

    function displayResult(operation, result, inputs) {
        let html = '<h3>Result:</h3>';
        switch(operation) {
            case 'infix_to_postfix':
                html += `<p><strong>Infix:</strong> ${inputs.expression}</p><p><strong>Postfix:</strong> ${result}</p>`;
                break;
            case 'infix_to_prefix':
                html += `<p><strong>Infix:</strong> ${inputs.expression}</p><p><strong>Prefix:</strong> ${result}</p>`;
                break;
            case 'simple_interest':
                html += `<p><strong>Principal:</strong> ${inputs.principal}</p><p><strong>Rate:</strong> ${inputs.rate}%</p><p><strong>Time:</strong> ${inputs.time} years</p><p><strong>Simple Interest:</strong> ${result}</p>`;
                break;
            case 'compound_interest':
                html += `<p><strong>Principal:</strong> ${inputs.principal}</p><p><strong>Rate:</strong> ${inputs.rate}%</p><p><strong>Time:</strong> ${inputs.time} years</p><p><strong>Frequency:</strong> ${inputs.frequency} times/year</p><p><strong>Compound Interest:</strong> ${result}</p>`;
                break;
            case 'circle_area':
                html += `<p><strong>Radius:</strong> ${inputs.radius}</p><p><strong>Area:</strong> ${result}</p>`;
                break;
            case 'rectangle_area':
                html += `<p><strong>Length:</strong> ${inputs.length}</p><p><strong>Width:</strong> ${inputs.width}</p><p><strong>Area:</strong> ${result}</p>`;
                break;
            case 'factorial':
                html += `<p><strong>Number:</strong> ${inputs.number}</p><p><strong>Factorial:</strong> ${result}</p>`;
                break;
            case 'average':
                html += `<p><strong>Numbers:</strong> ${inputs.numbers.join(', ')}</p><p><strong>Average:</strong> ${result}</p>`;
                break;
        }
        resultBox.innerHTML = html;
        resultBox.classList.add('show');
    }

    // expose loadHistory globally (history.js will call it)
    window.loadHistory = loadHistory;
    loadHistory(); // initial
});
