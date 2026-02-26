/**
 * Test Dynamic Start Date Simulator
 */
function testSimulation(softLimit: number) {
    const exams = [
        { id: '2', date: new Date('2026-03-03'), hours: 5 },
        { id: '1', date: new Date('2026-03-04'), hours: 5 },
        { id: 'm123', date: new Date('2026-03-08'), hours: 5 },
        { id: '2122', date: new Date('2026-03-11'), hours: 5 },
        { id: 'math', date: new Date('2026-03-11'), hours: 5 },
        { id: 'bio12', date: new Date('2026-03-12'), hours: 5 },
        { id: 'math2', date: new Date('2026-03-12'), hours: 5 }
    ];

    const optimalStarts: Record<string, string> = {};
    const remainingHours = Object.fromEntries(exams.map(e => [e.id, e.hours]));
    let activeExams = [...exams];
    const sortedByDate = [...exams].sort((a, b) => b.date.getTime() - a.date.getTime());
    let currentDay = new Date(sortedByDate[0].date);

    while (activeExams.length > 0) {
        const timeStr = currentDay.toISOString().split('T')[0];
        const canStudy = activeExams.filter(e => e.date >= currentDay);

        if (canStudy.length > 0) {
            const share = softLimit / canStudy.length;
            console.log(`[${timeStr}] ${canStudy.length} active exams sharing ${softLimit}h: ${share.toFixed(2)}h each`);
            for (const e of canStudy) {
                remainingHours[e.id] -= share;
                if (remainingHours[e.id] <= 0) {
                    optimalStarts[e.id] = timeStr;
                    activeExams = activeExams.filter(x => x.id !== e.id);
                }
            }
        }
        currentDay.setDate(currentDay.getDate() - 1);
    }

    console.log('\nResults for Soft Limit =', softLimit);
    for (const e of exams) {
        console.log(`  ${e.id} (Exam: ${e.date.toISOString().split('T')[0]}) -> Starts: ${optimalStarts[e.id]}`);
    }
    console.log('---------------\n');
}

testSimulation(3);
testSimulation(2);
testSimulation(4);
