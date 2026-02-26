/**
 * Test per-exam optimal start math
 */
function testPerExamMath(
    softLimit: number,
    dailyMax: number,
    overlappingExamsCount: number,
    sessionsNeeded: number,
    chunkHours: number
) {
    // Original broken math
    const oldEffectiveCapacity = Math.min(softLimit, dailyMax / Math.max(1, overlappingExamsCount));
    const oldSessionsPerDay = Math.max(1, Math.floor(oldEffectiveCapacity / chunkHours));
    const oldDaysNeeded = Math.ceil(sessionsNeeded / oldSessionsPerDay);

    // New exact float math
    const effectiveSoftLimit = Math.min(softLimit, dailyMax);
    const exactDailyCapacityHours = overlappingExamsCount > 1
        ? effectiveSoftLimit / overlappingExamsCount
        : effectiveSoftLimit;

    // Hours needed for THIS exam
    const hoursNeeded = sessionsNeeded * chunkHours;
    const newDaysNeeded = Math.ceil(hoursNeeded / exactDailyCapacityHours);

    console.log(`Soft=${softLimit}, Max=${dailyMax}, Overlap=${overlappingExamsCount}, Sessions=${sessionsNeeded}, Chunk=${chunkHours}h`);
    console.log(`  Old approach: ${oldDaysNeeded} days (forces ${sessionsNeeded * chunkHours / oldDaysNeeded} h/day max)`);
    console.log(`  New approach: ${newDaysNeeded} days (allows ${(overlappingExamsCount * hoursNeeded / newDaysNeeded).toFixed(2)} h/day combined average)`);
    console.log('');
}

testPerExamMath(3, 4, 4, 5, 1);    // 4 overlapping exams, user asked for soft=3
testPerExamMath(2, 4, 4, 5, 1);    // 4 overlapping exams, user asked for soft=2
testPerExamMath(6, 4, 6, 10, 0.5); // User's broken config: 6 exams overlap, soft=6 (clamped), sessions=0.5h
testPerExamMath(3, 4, 1, 5, 1);    // 1 isolated exam, soft=3
