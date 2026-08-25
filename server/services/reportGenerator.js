const PDFDocument = require('pdfkit');

// ─── Color palette ───
const COLORS = {
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    secondary: '#00B894',
    accent: '#FDCB6E',
    danger: '#E17055',
    dark: '#2D3436',
    medium: '#636E72',
    light: '#B2BEC3',
    white: '#FFFFFF',
    bg: '#F8F9FA',
    gold: '#F1C40F',
    silver: '#95A5A6',
    bronze: '#E67E22',
};

/**
 * Generate a full session PDF report.
 * 
 * @param {Object} session - Session document (populated)
 * @param {Array} players - Player results array
 * @param {Array} questions - Quiz questions array
 * @returns {PDFDocument} - Piped PDF document (call doc.end() after piping)
 */
function generateSessionReport(session, players, questions) {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const quizTitle = session.quizId?.title || 'Quiz Session';
    const totalQuestions = questions.length;
    const totalPlayers = players.length;
    const avgScore = totalPlayers > 0
        ? (sortedPlayers.reduce((sum, p) => sum + p.score, 0) / totalPlayers).toFixed(1)
        : 0;
    const completionRate = totalPlayers > 0
        ? Math.round((sortedPlayers.filter(p => p.finished).length / totalPlayers) * 100)
        : 0;

    // ═══════════════════════════════════════════════════════════
    // PAGE 1 — Session Summary
    // ═══════════════════════════════════════════════════════════
    drawHeader(doc, session);

    // Quiz Info Box
    doc.fontSize(22).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text(quizTitle, 50, 130, { width: 495 });

    doc.moveDown(0.3);
    doc.fontSize(11).fillColor(COLORS.medium).font('Helvetica')
        .text(`Game PIN: ${session.gamePin}  |  Duration: ${formatDuration(session.duration)}  |  Players: ${totalPlayers}`, 50);

    // Stats bar
    const statsY = doc.y + 20;
    const statsWidth = 165;

    drawStatBox(doc, 50, statsY, statsWidth, 'Questions', totalQuestions.toString(), COLORS.primary);
    drawStatBox(doc, 50 + statsWidth + 10, statsY, statsWidth, 'Avg Score', `${avgScore}/${totalQuestions}`, COLORS.secondary);
    drawStatBox(doc, 50 + (statsWidth + 10) * 2, statsY, statsWidth, 'Completion', `${completionRate}%`, COLORS.accent);

    // Top 3 Podium
    if (sortedPlayers.length > 0) {
        doc.y = statsY + 90;
        doc.fontSize(16).fillColor(COLORS.dark).font('Helvetica-Bold')
            .text('🏆 Top Players', 50);
        doc.moveDown(0.5);

        const podiumY = doc.y;
        const podiumColors = [COLORS.gold, COLORS.silver, COLORS.bronze];
        const podiumLabels = ['1st', '2nd', '3rd'];

        for (let i = 0; i < Math.min(3, sortedPlayers.length); i++) {
            const player = sortedPlayers[i];
            const x = 50 + i * 170;

            doc.roundedRect(x, podiumY, 155, 70, 8)
                .fillAndStroke(podiumColors[i], podiumColors[i]);

            doc.fontSize(12).fillColor(COLORS.white).font('Helvetica-Bold')
                .text(podiumLabels[i], x + 10, podiumY + 10, { width: 135 });

            doc.fontSize(14).fillColor(COLORS.white).font('Helvetica-Bold')
                .text(player.name || 'Unknown', x + 10, podiumY + 28, { width: 135 });

            doc.fontSize(11).fillColor(COLORS.white).font('Helvetica')
                .text(`Score: ${player.score}/${totalQuestions}`, x + 10, podiumY + 48, { width: 135 });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PAGE 2 — Per-Player Breakdown
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    drawHeader(doc, session);

    doc.fontSize(16).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text('Player Breakdown', 50, 110);
    doc.moveDown(0.5);

    // Table header
    const tableX = 50;
    let tableY = doc.y;
    const colWidths = [35, 100, 45, 50, 50, 60, 55, 60];
    const headers = ['Rank', 'Player', 'Score', 'Correct', 'Wrong', 'Unanswered', 'Violations', 'Avg Time'];

    doc.rect(tableX, tableY, 495, 22).fill(COLORS.primary);
    let headerX = tableX + 5;
    headers.forEach((h, i) => {
        doc.fontSize(8).fillColor(COLORS.white).font('Helvetica-Bold')
            .text(h, headerX, tableY + 6, { width: colWidths[i] - 5, align: 'left' });
        headerX += colWidths[i];
    });

    tableY += 22;

    sortedPlayers.forEach((player, idx) => {
        if (tableY > 750) {
            doc.addPage();
            drawHeader(doc, session);
            tableY = 110;
        }

        const bgColor = idx % 2 === 0 ? '#F8F9FA' : COLORS.white;
        doc.rect(tableX, tableY, 495, 20).fill(bgColor);

        let cellX = tableX + 5;
        const rowData = [
            (idx + 1).toString(),
            (player.name || 'Unknown').substring(0, 15),
            player.score.toString(),
            (player.correctAnswers || 0).toString(),
            (player.wrongAnswers || 0).toString(),
            (player.unanswered || 0).toString(),
            (player.violationCount || 0).toString(),
            player.avgResponseTime ? `${player.avgResponseTime.toFixed(1)}s` : 'N/A'
        ];

        rowData.forEach((val, i) => {
            const color = i === 6 && parseInt(val) > 0 ? COLORS.danger : COLORS.dark;
            doc.fontSize(8).fillColor(color).font('Helvetica')
                .text(val, cellX, tableY + 5, { width: colWidths[i] - 5, align: 'left' });
            cellX += colWidths[i];
        });

        tableY += 20;
    });

    // ═══════════════════════════════════════════════════════════
    // PAGE 3 — Question Analysis
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    drawHeader(doc, session);

    doc.fontSize(16).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text('Question Analysis', 50, 110);
    doc.moveDown(0.5);

    let qY = doc.y;

    questions.forEach((q, qIdx) => {
        if (qY > 680) {
            doc.addPage();
            drawHeader(doc, session);
            qY = 110;
        }

        // Question header
        doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold')
            .text(`Q${qIdx + 1}.`, 50, qY);

        doc.fontSize(10).fillColor(COLORS.dark).font('Helvetica')
            .text(q.text || 'Question text', 75, qY, { width: 450 });

        qY = doc.y + 5;

        // Correct answer
        const correctOption = q.options?.[q.correctIndex] || 'N/A';
        doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica-Bold')
            .text(`✓ Correct: ${correctOption}`, 75, qY);

        qY = doc.y + 3;

        // Stats
        const playersCorrect = sortedPlayers.filter(p => {
            const answer = p.answers?.find(a => a.questionIndex === qIdx);
            return answer?.isCorrect;
        }).length;
        const correctPct = totalPlayers > 0 ? Math.round((playersCorrect / totalPlayers) * 100) : 0;

        // Most common wrong answer
        const wrongAnswerCounts = {};
        sortedPlayers.forEach(p => {
            const answer = p.answers?.find(a => a.questionIndex === qIdx);
            if (answer && !answer.isCorrect && answer.selectedIndex !== undefined) {
                const opt = q.options?.[answer.selectedIndex] || 'Unknown';
                wrongAnswerCounts[opt] = (wrongAnswerCounts[opt] || 0) + 1;
            }
        });
        const mostCommonWrong = Object.entries(wrongAnswerCounts).sort((a, b) => b[1] - a[1])[0];

        doc.fontSize(8).fillColor(COLORS.medium).font('Helvetica')
            .text(`${correctPct}% correct${mostCommonWrong ? `  |  Most common wrong: "${mostCommonWrong[0]}"` : ''}`, 75, qY);

        qY = doc.y + 12;
    });

    // ═══════════════════════════════════════════════════════════
    // PAGE 4 — Integrity Report
    // ═══════════════════════════════════════════════════════════
    doc.addPage();
    drawHeader(doc, session);

    doc.fontSize(16).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text('Integrity Report', 50, 110);
    doc.moveDown(0.5);

    // Aggregate violations by type
    const violationTypes = {
        'fullscreen_exit': 'Fullscreen Exit',
        'screenshot': 'Screenshot Attempt',
        'minimize_or_tab': 'Tab Switch',
        'blur': 'Focus Loss',
        'resize': 'Window Resize',
        'fullscreen_denied': 'Fullscreen Denied',
        'not_fullscreen': 'Not Fullscreen'
    };

    const totalViolations = {};
    let totalViolationCount = 0;

    sortedPlayers.forEach(p => {
        if (p.violations) {
            const violations = p.violations instanceof Map ? Object.fromEntries(p.violations) : p.violations;
            for (const [type, count] of Object.entries(violations)) {
                totalViolations[type] = (totalViolations[type] || 0) + count;
                totalViolationCount += count;
            }
        }
    });

    // Violation summary boxes
    let vBoxY = doc.y;
    doc.fontSize(12).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text('Violations by Type', 50, vBoxY);
    vBoxY += 25;

    if (totalViolationCount === 0) {
        doc.fontSize(11).fillColor(COLORS.secondary).font('Helvetica')
            .text('✓ No violations detected — perfect integrity!', 50, vBoxY);
        vBoxY += 30;
    } else {
        for (const [type, label] of Object.entries(violationTypes)) {
            const count = totalViolations[type] || 0;
            if (count > 0) {
                doc.fontSize(9).fillColor(COLORS.dark).font('Helvetica')
                    .text(`${label}: `, 60, vBoxY, { continued: true });
                doc.fillColor(COLORS.danger).font('Helvetica-Bold')
                    .text(count.toString());
                vBoxY = doc.y + 3;
            }
        }
    }

    // Per-player violation log
    vBoxY = doc.y + 20;
    doc.fontSize(12).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text('Per-Player Violations', 50, vBoxY);
    vBoxY += 25;

    sortedPlayers.forEach(player => {
        if (vBoxY > 720) {
            doc.addPage();
            drawHeader(doc, session);
            vBoxY = 110;
        }

        const vCount = player.violationCount || 0;
        const nameColor = vCount > 0 ? COLORS.danger : COLORS.secondary;

        doc.fontSize(9).fillColor(nameColor).font('Helvetica-Bold')
            .text(`${player.name || 'Unknown'}`, 60, vBoxY, { continued: true });
        doc.fillColor(COLORS.medium).font('Helvetica')
            .text(` — ${vCount} violation${vCount !== 1 ? 's' : ''}`);

        if (player.violationLog && player.violationLog.length > 0) {
            player.violationLog.forEach(log => {
                vBoxY = doc.y + 2;
                doc.fontSize(7).fillColor(COLORS.light).font('Helvetica')
                    .text(`  ${new Date(log.timestamp).toLocaleTimeString()} — ${violationTypes[log.type] || log.type}`, 80, vBoxY);
            });
        }

        vBoxY = doc.y + 8;
    });

    // Overall integrity score
    const maxPenalty = totalPlayers * 10; // Max 10 penalty points per player
    const penaltyPerViolation = 2;
    const totalPenalty = Math.min(totalViolationCount * penaltyPerViolation, maxPenalty);
    const integrityScore = maxPenalty > 0
        ? Math.max(0, Math.round(100 - (totalPenalty / maxPenalty) * 100))
        : 100;

    vBoxY = doc.y + 20;
    if (vBoxY > 720) { doc.addPage(); drawHeader(doc, session); vBoxY = 110; }

    const scoreColor = integrityScore >= 80 ? COLORS.secondary :
        integrityScore >= 50 ? COLORS.accent : COLORS.danger;

    doc.roundedRect(50, vBoxY, 495, 50, 8)
        .fillAndStroke(scoreColor, scoreColor);

    doc.fontSize(16).fillColor(COLORS.white).font('Helvetica-Bold')
        .text(`Overall Integrity Score: ${integrityScore}%`, 70, vBoxY + 16, { width: 455 });

    return doc;
}

/**
 * Generate a single-page personal player report.
 */
function generatePlayerReport(session, player, questions, rank) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    drawHeader(doc, session);

    const quizTitle = session.quizId?.title || 'Quiz Session';

    doc.fontSize(20).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text(`Player Report: ${player.name || 'Unknown'}`, 50, 120);

    doc.moveDown(0.3);
    doc.fontSize(11).fillColor(COLORS.medium).font('Helvetica')
        .text(`${quizTitle}  |  PIN: ${session.gamePin}  |  Rank: #${rank}`);

    // Score summary
    const summaryY = doc.y + 15;
    const totalQ = questions.length;

    drawStatBox(doc, 50, summaryY, 120, 'Score', `${player.score}/${totalQ}`, COLORS.primary);
    drawStatBox(doc, 180, summaryY, 120, 'Correct', (player.correctAnswers || 0).toString(), COLORS.secondary);
    drawStatBox(doc, 310, summaryY, 100, 'Wrong', (player.wrongAnswers || 0).toString(), COLORS.danger);
    drawStatBox(doc, 420, summaryY, 125, 'Violations', (player.violationCount || 0).toString(),
        player.violationCount > 0 ? COLORS.danger : COLORS.secondary);

    // Per-question breakdown
    let qY = summaryY + 80;
    doc.fontSize(14).fillColor(COLORS.dark).font('Helvetica-Bold')
        .text('Question Breakdown', 50, qY);
    qY += 25;

    questions.forEach((q, idx) => {
        if (qY > 720) {
            doc.addPage();
            drawHeader(doc, session);
            qY = 110;
        }

        const answer = player.answers?.find(a => a.questionIndex === idx);
        const isCorrect = answer?.isCorrect;
        const icon = isCorrect ? '✓' : answer ? '✗' : '—';
        const iconColor = isCorrect ? COLORS.secondary : answer ? COLORS.danger : COLORS.light;

        doc.fontSize(9).fillColor(iconColor).font('Helvetica-Bold')
            .text(icon, 55, qY, { continued: true });

        doc.fillColor(COLORS.dark).font('Helvetica')
            .text(` Q${idx + 1}: ${(q.text || '').substring(0, 80)}`, { width: 450 });

        if (answer && !isCorrect) {
            doc.fontSize(7).fillColor(COLORS.medium).font('Helvetica')
                .text(`   Your answer: ${q.options?.[answer.selectedIndex] || 'N/A'}  |  Correct: ${q.options?.[q.correctIndex] || 'N/A'}`, 70);
        }

        qY = doc.y + 6;
    });

    // Personal violations
    if (player.violationCount > 0) {
        qY = doc.y + 15;
        if (qY > 720) { doc.addPage(); drawHeader(doc, session); qY = 110; }

        doc.fontSize(12).fillColor(COLORS.danger).font('Helvetica-Bold')
            .text(`Violations (${player.violationCount})`, 50, qY);
        qY = doc.y + 8;

        if (player.violationLog && player.violationLog.length > 0) {
            player.violationLog.forEach(log => {
                doc.fontSize(8).fillColor(COLORS.medium).font('Helvetica')
                    .text(`• ${new Date(log.timestamp).toLocaleTimeString()} — ${log.type}`, 60, qY);
                qY = doc.y + 3;
            });
        }
    }

    return doc;
}

// ─── Helper functions ───

function drawHeader(doc, session) {
    doc.fontSize(10).fillColor(COLORS.primary).font('Helvetica-Bold')
        .text('QuizMaster.AI', 50, 40);

    doc.fontSize(8).fillColor(COLORS.light).font('Helvetica')
        .text(`Generated: ${new Date().toLocaleString()}`, 350, 42, { width: 195, align: 'right' });

    doc.moveTo(50, 60).lineTo(545, 60).strokeColor(COLORS.primaryLight).lineWidth(0.5).stroke();
}

function drawStatBox(doc, x, y, width, label, value, color) {
    doc.roundedRect(x, y, width, 55, 6).fill('#F0F0F5');

    doc.fontSize(8).fillColor(COLORS.medium).font('Helvetica')
        .text(label, x + 10, y + 10, { width: width - 20 });

    doc.fontSize(20).fillColor(color).font('Helvetica-Bold')
        .text(value, x + 10, y + 25, { width: width - 20 });
}

function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

module.exports = { generateSessionReport, generatePlayerReport };
