document.addEventListener('DOMContentLoaded', () => {
    const addProcessForm = document.getElementById('addProcessForm');
    const arrivalTimeInput = document.getElementById('arrivalTime');
    const burstTimeInput = document.getElementById('burstTime');
    const processTableBody = document.getElementById('processTable').getElementsByTagName('tbody')[0];
    const runFCFSButton = document.getElementById('runFCFS');
    const resetProcessesButton = document.getElementById('resetProcesses');

    const ganttChartDiv = document.getElementById('ganttChart');
    const timelineDiv = document.getElementById('timeline');
    const cpuStatusP = document.getElementById('cpuStatus');

    const resultsTableBody = document.getElementById('resultsTable').getElementsByTagName('tbody')[0];
    const avgTATP = document.getElementById('avgTAT');
    const avgWTP = document.getElementById('avgWT');

    let processes = [];
    let processIdCounter = 1;
    const processColors = ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'];
    let colorIndex = 0;

    addProcessForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const arrivalTime = parseInt(arrivalTimeInput.value);
        const burstTime = parseInt(burstTimeInput.value);

        if (isNaN(arrivalTime) || isNaN(burstTime) || arrivalTime < 0 || burstTime <= 0) {
            alert('Please enter valid non-negative Arrival Time and positive Burst Time.');
            return;
        }

        const newProcess = {
            id: `P${processIdCounter++}`,
            arrivalTime: arrivalTime,
            burstTime: burstTime,
            color: processColors[colorIndex % processColors.length]
        };
        colorIndex++;
        processes.push(newProcess);
        renderProcessTable();
        runFCFSButton.disabled = false;
        
        // Suggest next arrival time
        if (processes.length > 0) {
            const lastProcess = processes[processes.length -1];
            // arrivalTimeInput.value = lastProcess.arrivalTime; // Could be confusing
        }
        burstTimeInput.value = Math.floor(Math.random() * 10) + 1; // Random next burst
        arrivalTimeInput.focus();
    });

    resetProcessesButton.addEventListener('click', () => {
        processes = [];
        processIdCounter = 1;
        colorIndex = 0;
        renderProcessTable();
        clearGanttAndResults();
        runFCFSButton.disabled = true;
        arrivalTimeInput.value = "0";
        burstTimeInput.value = "1";
    });

    runFCFSButton.addEventListener('click', async () => {
        if (processes.length === 0) {
            alert('No processes to schedule!');
            return;
        }
        runFCFSButton.disabled = true;
        resetProcessesButton.disabled = true;

        clearGanttAndResults();
        await executeFCFS();

        runFCFSButton.disabled = false;
        resetProcessesButton.disabled = false;
    });

    function renderProcessTable() {
        processTableBody.innerHTML = ''; // Clear existing rows
        processes.forEach(p => {
            const row = processTableBody.insertRow();
            row.classList.add('process-table-row');
            row.setAttribute('data-process-id', p.id);
            row.insertCell().textContent = p.id;
            row.insertCell().textContent = p.arrivalTime;
            row.insertCell().textContent = p.burstTime;
            row.classList.add('new-row'); // For animation
            setTimeout(() => row.classList.remove('new-row'), 500);
        });
    }

    function clearGanttAndResults() {
        ganttChartDiv.innerHTML = '';
        timelineDiv.innerHTML = '';
        resultsTableBody.innerHTML = '';
        avgTATP.textContent = 'N/A';
        avgWTP.textContent = 'N/A';
        cpuStatusP.textContent = 'CPU Status: IDLE';
        // Remove active class from any process table rows
        document.querySelectorAll('.process-table-row.active-process').forEach(row => {
            row.classList.remove('active-process');
        });
    }

    async function executeFCFS() {
        // Sort processes by arrival time (FCFS specific)
        const sortedProcesses = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);

        let currentTime = 0;
        let totalTAT = 0;
        let totalWT = 0;
        const completedProcesses = [];
        let ganttData = []; // To store {id, start, duration, color, isIdle}

        for (let i = 0; i < sortedProcesses.length; i++) {
            const process = sortedProcesses[i];
            const processTableRow = document.querySelector(`.process-table-row[data-process-id="${process.id}"]`);
            if(processTableRow) processTableRow.classList.add('active-process');

            cpuStatusP.textContent = `CPU Status: Waiting for P${process.id} (Arrival: ${process.arrivalTime})`;
            await delay(500); // Small delay for visual effect

            // Handle CPU idle time
            if (currentTime < process.arrivalTime) {
                const idleTime = process.arrivalTime - currentTime;
                ganttData.push({ id: 'Idle', start: currentTime, duration: idleTime, color: '#bbb', isIdle: true });
                currentTime = process.arrivalTime;
            }
            
            cpuStatusP.textContent = `CPU Status: Running P${process.id}`;
            const startTime = currentTime;
            const completionTime = startTime + process.burstTime;
            const turnaroundTime = completionTime - process.arrivalTime;
            const waitingTime = turnaroundTime - process.burstTime; // or startTime - process.arrivalTime

            process.startTime = startTime;
            process.completionTime = completionTime;
            process.turnaroundTime = turnaroundTime;
            process.waitingTime = waitingTime;

            totalTAT += turnaroundTime;
            totalWT += waitingTime;
            
            completedProcesses.push(process);
            ganttData.push({ id: process.id, start: startTime, duration: process.burstTime, color: process.color, isIdle: false });

            currentTime = completionTime;
            
            // Animate Gantt chart block by block
            await renderGanttChart(ganttData, completedProcesses);
            renderResultsTable(completedProcesses, totalTAT, totalWT); // Update results table progressively
            
            if(processTableRow) processTableRow.classList.remove('active-process');
            await delay(300 + process.burstTime * 50); // Delay proportional to burst time
        }
        
        cpuStatusP.textContent = `CPU Status: All processes completed at time ${currentTime}. IDLE.`;
        renderGanttChart(ganttData, completedProcesses); // Final render
        renderResultsTable(completedProcesses, totalTAT, totalWT); // Final results
    }

    async function renderGanttChart(ganttData, completedProcesses) {
        ganttChartDiv.innerHTML = ''; // Clear previous blocks for progressive rendering
        timelineDiv.innerHTML = '';

        if (ganttData.length === 0) return;

        const totalDuration = ganttData.reduce((sum, block) => sum + block.duration, 0);
        if (totalDuration === 0) return;

        // Calculate overall end time for timeline
        const overallEndTime = ganttData[ganttData.length - 1].start + ganttData[ganttData.length - 1].duration;

        // Create Gantt blocks
        for (const blockData of ganttData) {
            const block = document.createElement('div');
            block.classList.add('gantt-block');
            if (blockData.isIdle) block.classList.add('idle');
            block.style.backgroundColor = blockData.color;
            block.style.width = `${(blockData.duration / overallEndTime) * 100}%`; // Relative width
            block.textContent = blockData.id;
            
            ganttChartDiv.appendChild(block);
            // Trigger animation
            await delay(10); // Small delay to ensure transition applies
            block.style.opacity = '1';
        }

        // Create Timeline
        const timeMarkerStep = Math.max(1, Math.floor(overallEndTime / 20)); // Aim for ~20 markers
        let currentTimeForMarker = 0;
        
        // Start marker at 0
        const zeroMarker = document.createElement('div');
        zeroMarker.classList.add('timeline-marker');
        zeroMarker.textContent = '0';
        zeroMarker.style.left = '0%';
        timelineDiv.appendChild(zeroMarker);

        ganttData.forEach(block => {
            currentTimeForMarker = block.start + block.duration;
            const marker = document.createElement('div');
            marker.classList.add('timeline-marker');
            marker.textContent = currentTimeForMarker;
            // Position relative to the total width of the timeline div
            marker.style.left = `${(currentTimeForMarker / overallEndTime) * 100}%`; 
            // Adjust if it overlaps with previous (simple check)
            const lastMarker = timelineDiv.lastChild;
            if (lastMarker && parseFloat(marker.style.left) - parseFloat(lastMarker.style.left) < 2) { 
                // Heuristic to avoid too much overlap, might need refinement
                // Or just let them overlap slightly
            }
            timelineDiv.appendChild(marker);
        });
    }


    function renderResultsTable(completedProcesses, totalTAT, totalWT) {
        resultsTableBody.innerHTML = ''; // Clear for re-render
        completedProcesses.sort((a,b) => parseInt(a.id.substring(1)) - parseInt(b.id.substring(1))); // Sort by original P ID

        completedProcesses.forEach(p => {
            const row = resultsTableBody.insertRow();
            row.classList.add('results-table-row'); // For potential styling
            row.setAttribute('data-process-id', p.id);

            row.insertCell().textContent = p.id;
            row.insertCell().textContent = p.arrivalTime;
            row.insertCell().textContent = p.burstTime;
            row.insertCell().textContent = p.completionTime;
            row.insertCell().textContent = p.turnaroundTime;
            row.insertCell().textContent = p.waitingTime;
            
            // Highlight if this was the last process added to results
            if (completedProcesses[completedProcesses.length - 1].id === p.id && document.querySelector(`.gantt-block:last-child`)?.textContent === p.id) {
                 // This check is a bit loose, might need to pass 'current' process
            }
        });

        if (completedProcesses.length > 0) {
            avgTATP.textContent = (totalTAT / completedProcesses.length).toFixed(2);
            avgWTP.textContent = (totalWT / completedProcesses.length).toFixed(2);
        } else {
            avgTATP.textContent = 'N/A';
            avgWTP.textContent = 'N/A';
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Initial state
    runFCFSButton.disabled = true;
});