"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudyPlannerV1 = void 0;
// V1 Study Planner Algorithm
console.log('=== SCHEDULER FILE LOADED ===');
var StudyPlannerV1 = /** @class */ (function () {
    function StudyPlannerV1(inputs) {
        var _a, _b;
        this.schedule = [];
        this.preliminarySchedules = new Map();
        console.log('=== SCHEDULER CONSTRUCTOR CALLED ===');
        console.log('Number of exams:', inputs.exams.length);
        console.log('Number of existing sessions:', ((_a = inputs.existing_sessions) === null || _a === void 0 ? void 0 : _a.length) || 0);
        console.log('Existing sessions:', ((_b = inputs.existing_sessions) === null || _b === void 0 ? void 0 : _b.map(function (s) { return ({ subject: s.subjectId, date: s.date }); })) || []);
        console.log('Completed hours:', inputs.completed_hours || {});
        this.inputs = inputs;
        if (this.inputs.enable_daily_limits === false) {
            console.log('Daily preference disabled: ignoring soft_daily_limit, using daily_max_hours as ceiling');
        }
        this.subjects = this.initializeInternalState(inputs.exams);
    }
    // Returns the effective soft limit for scheduling distribution.
    // When daily preferences are ON: returns soft_daily_limit (user's preferred daily target)
    // When daily preferences are OFF: returns daily_max_hours (hard ceiling, no soft preference)
    // This is used for optimal start date calculations and session distribution targets.
    StudyPlannerV1.prototype.getEffectiveSoftLimit = function () {
        var _a;
        if (this.inputs.enable_daily_limits === false) {
            // No soft preference — use the hard max as the ceiling.
            // The key difference from ON: optimal start dates are skipped (see generateValidSlotsForExam),
            // so sessions spread across ALL available days rather than being compressed.
            return this.inputs.daily_max_hours;
        }
        return (_a = this.inputs.soft_daily_limit) !== null && _a !== void 0 ? _a : 2;
    };
    StudyPlannerV1.prototype.getMaxSessionsPerDayForExamId = function (examId) {
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        return Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);
    };
    StudyPlannerV1.prototype.getExistingHoursForDate = function (date) {
        if (!this.inputs.existing_sessions)
            return 0;
        var dateStr = date.toISOString().split('T')[0];
        var totalHours = this.inputs.existing_sessions
            .filter(function (session) { return session.date.toISOString().split('T')[0] === dateStr; })
            .reduce(function (total, session) { return total + session.duration; }, 0);
        return totalHours;
    };
    // Group exams whose minimum study windows overlap using union-find.
    // Window = [examDate - ceil(hours/softLimit), examDate]. If they overlap → same group.
    StudyPlannerV1.prototype.computeExamGroups = function () {
        var _this = this;
        var _a;
        var softLimit = this.getEffectiveSoftLimit();
        var validExams = this.inputs.exams.filter(function (e) {
            var _a;
            var completedHrs = ((_a = _this.inputs.completed_hours) === null || _a === void 0 ? void 0 : _a[e.id]) || 0;
            return _this.calculateTotalHours(e) - completedHrs > 0;
        });
        if (validExams.length === 0)
            return new Map();
        // Compute each exam's minimum study window
        var windows = [];
        for (var _i = 0, validExams_1 = validExams; _i < validExams_1.length; _i++) {
            var exam = validExams_1[_i];
            var completedHrs = ((_a = this.inputs.completed_hours) === null || _a === void 0 ? void 0 : _a[exam.id]) || 0;
            var remainingHours = Math.max(0, this.calculateTotalHours(exam) - completedHrs);
            var daysNeeded = Math.ceil(remainingHours / softLimit);
            // Use exam date as window end (not last study day) + 1 day buffer for grouping purpo
            // so adjacent-day exams get grouped togetherses
            var examDateStr = exam.exam_date.toISOString().split('T')[0];
            var end = new Date(examDateStr + 'T00:00:00.000Z');
            var start = new Date(end.getTime() - daysNeeded * 24 * 60 * 60 * 1000);
            windows.push({ id: exam.id, subject: exam.subject, start: start.getTime(), end: end.getTime() });
        }
        // Union-Find
        var parent = {};
        var find = function (x) { if (parent[x] !== x)
            parent[x] = find(parent[x]); return parent[x]; };
        var union = function (a, b) { var ra = find(a), rb = find(b); if (ra !== rb)
            parent[ra] = rb; };
        for (var _b = 0, windows_1 = windows; _b < windows_1.length; _b++) {
            var w = windows_1[_b];
            parent[w.id] = w.id;
        }
        for (var i = 0; i < windows.length; i++) {
            for (var j = i + 1; j < windows.length; j++) {
                var a = windows[i], b = windows[j];
                if (a.start <= b.end && b.start <= a.end) {
                    union(a.id, b.id);
                }
            }
        }
        // Build groups
        var groups = new Map();
        for (var _c = 0, windows_2 = windows; _c < windows_2.length; _c++) {
            var w = windows_2[_c];
            var root = find(w.id);
            if (!groups.has(root))
                groups.set(root, []);
            groups.get(root).push(w.id);
        }
        // Log
        var entries = Array.from(groups.entries());
        for (var _d = 0, entries_1 = entries; _d < entries_1.length; _d++) {
            var _e = entries_1[_d], ids = _e[1];
            var names = ids.map(function (id) { var _a; return ((_a = validExams.find(function (e) { return e.id === id; })) === null || _a === void 0 ? void 0 : _a.subject) || id; });
            console.log("  \uD83D\uDCE6 Group: [".concat(names.join(', '), "]"));
        }
        return groups;
    };
    // Calculate the optimal start date per group, return the earliest.
    // Each group only counts its own exams' hours. Isolated exams don't affect other groups.
    StudyPlannerV1.prototype.calculateOptimalStartDate = function () {
        var _a, _b;
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var softLimit = this.getEffectiveSoftLimit();
        var sessionsPerDayTarget = Math.max(1, Math.floor(softLimit / STUDY_CHUNK_HOURS));
        var groups = this.computeExamGroups();
        var now = new Date();
        var nowStr = "".concat(now.getFullYear(), "-").concat(String(now.getMonth() + 1).padStart(2, '0'), "-").concat(String(now.getDate()).padStart(2, '0'));
        var nowUTC = new Date(nowStr + 'T00:00:00.000Z');
        var earliestStart = nowUTC;
        var entries = Array.from(groups.entries());
        var _loop_1 = function (examIds) {
            var groupExams = this_1.inputs.exams.filter(function (e) { return examIds.includes(e.id); });
            // Sum hours only within this group
            var groupHours = 0;
            for (var _d = 0, groupExams_1 = groupExams; _d < groupExams_1.length; _d++) {
                var exam = groupExams_1[_d];
                var completed = ((_a = this_1.inputs.completed_hours) === null || _a === void 0 ? void 0 : _a[exam.id]) || 0;
                groupHours += Math.max(0, this_1.calculateTotalHours(exam) - completed);
            }
            // Latest exam in this group
            var latestExam = new Date(Math.max.apply(Math, groupExams.map(function (e) { return e.exam_date.getTime(); })));
            var latestStr = latestExam.toISOString().split('T')[0];
            var latestUTC = new Date(latestStr + 'T00:00:00.000Z');
            var daysNeeded = Math.ceil(groupHours / softLimit);
            var groupStart = new Date(latestUTC.getTime() - daysNeeded * 24 * 60 * 60 * 1000);
            // Safety clamp per exam within this group
            for (var _e = 0, groupExams_2 = groupExams; _e < groupExams_2.length; _e++) {
                var exam = groupExams_2[_e];
                var completed = ((_b = this_1.inputs.completed_hours) === null || _b === void 0 ? void 0 : _b[exam.id]) || 0;
                var sessionsNeeded = Math.ceil(Math.max(0, this_1.calculateTotalHours(exam) - completed) / STUDY_CHUNK_HOURS);
                var lastValid = new Date(exam.exam_date);
                if (!exam.can_study_after_exam)
                    lastValid.setDate(lastValid.getDate() - 1);
                var daysForExam = Math.ceil(sessionsNeeded / sessionsPerDayTarget);
                var required = new Date(lastValid);
                required.setDate(required.getDate() - daysForExam);
                if (groupStart > required)
                    groupStart = new Date(required);
            }
            if (groupStart < nowUTC)
                groupStart = nowUTC;
            var names = groupExams.map(function (e) { return e.subject; }).join(', ');
            console.log("  \uD83D\uDCE6 Group [".concat(names, "]: ").concat(groupHours, "h, ").concat(daysNeeded, "d, start=").concat(groupStart.toISOString().split('T')[0]));
            if (groupStart < earliestStart)
                earliestStart = groupStart;
        };
        var this_1 = this;
        for (var _i = 0, entries_2 = entries; _i < entries_2.length; _i++) {
            var _c = entries_2[_i], examIds = _c[1];
            _loop_1(examIds);
        }
        console.log("\uD83D\uDCD0 Optimal start (earliest group): ".concat(earliestStart.toISOString().split('T')[0]));
        return earliestStart;
    };
    StudyPlannerV1.prototype.generateValidSlotsForExam = function (exam) {
        var _a, _b;
        var validSlots = [];
        // Parse exam date as UTC to avoid timezone shifts
        var examDateStr = exam.exam_date.toISOString().split('T')[0];
        var examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
        // Get current date in local timezone, then convert to UTC date string
        var now = new Date();
        var nowLocalStr = "".concat(now.getFullYear(), "-").concat(String(now.getMonth() + 1).padStart(2, '0'), "-").concat(String(now.getDate()).padStart(2, '0'));
        var nowUTC = new Date(nowLocalStr + 'T00:00:00.000Z');
        console.log("  Current date: ".concat(nowLocalStr, ", nowUTC: ").concat(nowUTC.toISOString()));
        var inputStartStr = this.inputs.start_date.toISOString().split('T')[0];
        var startDateUTC = new Date(inputStartStr + 'T00:00:00.000Z');
        // Use the global start date for all exams (computed per-group in calculateOptimalStartDate).
        // Distribution works like OFF from this start date — no per-exam restriction.
        console.log("  \uD83D\uDCD0 Using start for ".concat(exam.subject, ": ").concat(startDateUTC.toISOString().split('T')[0]));
        var completedHrs = ((_a = this.inputs.completed_hours) === null || _a === void 0 ? void 0 : _a[exam.id]) || 0;
        var sessionsNeeded = Math.ceil(Math.max(0, this.calculateTotalHours(exam) - completedHrs) / (this.inputs.session_duration / 60));
        // If today is past the optimal start but we still have enough days, use today
        var daysAvailable = Math.floor((examDateUTC.getTime() - nowUTC.getTime()) / (24 * 60 * 60 * 1000));
        if (nowUTC > startDateUTC && daysAvailable >= sessionsNeeded + 1) {
            startDateUTC = nowUTC;
        }
        // Safety: never generate slots before today
        if (startDateUTC < nowUTC) {
            startDateUTC = nowUTC;
        }
        console.log("  Input start: ".concat(inputStartStr, ", Initial start date: ").concat(startDateUTC.toISOString().split('T')[0]));
        console.log("  Days until exam: ".concat(daysAvailable, ", Sessions needed: ").concat(sessionsNeeded));
        // Check if this exam has a large gap from the previous exam
        // If so, start valid slots after the previous exam to avoid clustering
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var completedHrsForSlots = ((_b = this.inputs.completed_hours) === null || _b === void 0 ? void 0 : _b[exam.id]) || 0;
        var totalHours = Math.max(0, this.calculateTotalHours(exam) - completedHrsForSlots);
        var totalSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);
        // Find the closest earlier exam (exam that happens before this one)
        // Compare using date strings to avoid timezone issues
        var earlierExams = this.inputs.exams
            .filter(function (e) {
            if (e.id === exam.id)
                return false;
            var eDate = e.exam_date.toISOString().split('T')[0];
            return eDate < examDateStr;
        })
            .sort(function (a, b) { return b.exam_date.getTime() - a.exam_date.getTime(); }); // Sort by date descending
        if (earlierExams.length > 0) {
            var closestEarlierExam = earlierExams[0];
            var earlierExamDateStr = closestEarlierExam.exam_date.toISOString().split('T')[0];
            var earlierExamDateUTC = new Date(earlierExamDateStr + 'T00:00:00.000Z');
            // Calculate the gap between the earlier exam and this exam
            var gapDays = Math.floor((examDateUTC.getTime() - earlierExamDateUTC.getTime()) / (24 * 60 * 60 * 1000));
            console.log("  \uD83D\uDD0D Gap check for ".concat(exam.subject, ":"));
            console.log("    Earlier exam: ".concat(closestEarlierExam.subject, " on ").concat(earlierExamDateStr));
            console.log("    This exam: ".concat(exam.subject, " on ").concat(examDateStr));
            console.log("    Gap: ".concat(gapDays, " days, Sessions needed: ").concat(totalSessions));
            console.log("    Threshold: ".concat(totalSessions + 2, " days"));
            // If gap is large enough for this exam's sessions (with buffer), use isolated distribution
            // Gap needs to be at least: sessions needed + 2 day buffer
            if (gapDays >= totalSessions + 2) {
                // Start from the day after the earlier exam
                var newStartDate = new Date(earlierExamDateUTC.getTime() + 24 * 60 * 60 * 1000);
                console.log("    newStartDate: ".concat(newStartDate.toISOString().split('T')[0], ", current startDateUTC: ").concat(startDateUTC.toISOString().split('T')[0]));
                // Use getTime() for reliable date comparison
                if (newStartDate.getTime() > startDateUTC.getTime()) {
                    startDateUTC = new Date(newStartDate);
                    console.log("    \u2713 Large gap detected! Using isolated distribution starting from ".concat(startDateUTC.toISOString().split('T')[0]));
                }
                else {
                    console.log("    \u2717 newStartDate not greater than startDateUTC, not applying isolation");
                }
            }
            else {
                console.log("    \u2717 Gap (".concat(gapDays, ") < threshold (").concat(totalSessions + 2, "), not applying isolation"));
            }
        }
        console.log("  Final start date: ".concat(startDateUTC.toISOString().split('T')[0]));
        // Determine the last valid study day
        var lastValidDay;
        if (exam.can_study_after_exam) {
            lastValidDay = new Date(examDateUTC); // Include exam day
        }
        else {
            lastValidDay = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000); // Day before exam
        }
        // Build set of blocked days for fast lookup
        var blockedSet = new Set(this.inputs.blocked_days || []);
        // Generate all valid days from start to last valid day (all in UTC), skipping blocked days
        for (var d = new Date(startDateUTC); d <= lastValidDay; d.setUTCDate(d.getUTCDate() + 1)) {
            var dateStr = d.toISOString().split('T')[0];
            if (blockedSet.has(dateStr)) {
                console.log("  \u26D4 Skipping blocked day: ".concat(dateStr));
                continue;
            }
            validSlots.push(new Date(d));
        }
        console.log("  Generated ".concat(validSlots.length, " valid slots:"), validSlots.map(function (d) { return d.toISOString().split('T')[0]; }));
        return validSlots;
    };
    StudyPlannerV1.prototype.getValidSlotsForAllExams = function () {
        var result = {};
        for (var _i = 0, _a = this.inputs.exams; _i < _a.length; _i++) {
            var exam = _a[_i];
            var validSlots = this.generateValidSlotsForExam(exam);
            result[exam.subject] = validSlots.map(function (date) { return date.toISOString().split('T')[0]; });
        }
        return result;
    };
    StudyPlannerV1.prototype.assignSessionsEvenly = function (exam, validSlots) {
        var _a;
        console.log("\n*** assignSessionsEvenly called for ".concat(exam.subject, " ***"));
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var calculatedHours = this.calculateTotalHours(exam);
        var completedHours = ((_a = this.inputs.completed_hours) === null || _a === void 0 ? void 0 : _a[exam.id]) || 0;
        var totalHours = Math.max(0, calculatedHours - completedHours);
        var totalSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);
        console.log("=== ASSIGNING SESSIONS FOR ".concat(exam.subject, " ==="));
        console.log("Calculated hours: ".concat(calculatedHours, ", Completed: ").concat(completedHours, ", Remaining: ").concat(totalHours, ", Sessions: ").concat(totalSessions));
        console.log("Session duration: ".concat(this.inputs.session_duration, " minutes = ").concat(STUDY_CHUNK_HOURS, " hours"));
        console.log("Valid slots:", validSlots.length, 'days:', validSlots.map(function (d) { return d.toISOString().split('T')[0]; }));
        var sessionMap = new Map();
        if (validSlots.length === 0 || totalSessions === 0) {
            console.log('No valid slots or sessions needed');
            return sessionMap;
        }
        var sortedSlots = __spreadArray([], validSlots, true).sort(function (a, b) { return a.getTime() - b.getTime(); });
        // Parse exam date as UTC to avoid timezone shifts
        var examDateStr = exam.exam_date.toISOString().split('T')[0];
        var examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
        var dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
        // Ensure final review session the day before exam (handled separately)
        var dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
        // Check if day before exam is available
        var dayBeforeExamAvailable = sortedSlots.some(function (slot) { return slot.toISOString().split('T')[0] === dayBeforeExamStr; });
        // Compute natural sessions/day from available slots — same for both ON and OFF.
        // With many days (OFF), this is ~1. With fewer days (ON), it's higher.
        var naturalSessionsPerDay = Math.ceil(totalSessions / Math.max(1, sortedSlots.length));
        var hasFinalReview = false;
        var finalReviewSessions = 0;
        if (dayBeforeExamAvailable && sortedSlots.length > 1) {
            finalReviewSessions = Math.min(naturalSessionsPerDay, totalSessions);
            sessionMap.set(dayBeforeExamStr, finalReviewSessions);
            hasFinalReview = true;
        }
        // Calculate remaining sessions and available days
        var remainingSessions = hasFinalReview ? totalSessions - finalReviewSessions : totalSessions;
        var availableDays = hasFinalReview
            ? sortedSlots.filter(function (slot) { return slot.toISOString().split('T')[0] !== dayBeforeExamStr; })
            : sortedSlots;
        console.log("Day before exam available: ".concat(dayBeforeExamAvailable, ", Total slots: ").concat(sortedSlots.length));
        console.log("Final review placed: ".concat(hasFinalReview, ", Remaining sessions to place: ").concat(remainingSessions, ", Available days: ").concat(availableDays.length));
        if (remainingSessions > 0 && availableDays.length > 0) {
            // Calculate optimal distribution allowing multiple sessions per day for even workload
            // Strategy 1: Try to distribute with 1 session per day and 3-day max gap
            var maxGapDays = 2; // 2 empty days = 3-day gap total
            // Calculate the ideal gap to distribute sessions evenly
            var idealGap = void 0;
            if (availableDays.length >= remainingSessions * 3) {
                // Lots of time available, prioritize even distribution over gap rules
                // Use smaller gaps to utilize more days
                idealGap = Math.floor((availableDays.length - remainingSessions) / Math.max(1, remainingSessions - 1));
                idealGap = Math.min(maxGapDays, Math.max(0, idealGap));
            }
            else {
                // Limited time, calculate optimal gap
                idealGap = Math.floor((availableDays.length - remainingSessions) / Math.max(1, remainingSessions - 1));
                idealGap = Math.min(maxGapDays, Math.max(0, idealGap));
            }
            // Work backwards from exam date with max 2-day interval between sessions
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var MAX_INTERVAL_DAYS = 2; // Standard 2-day max gap between sessions
            console.log("  Available days:", availableDays.map(function (d) { return d.toISOString().split('T')[0]; }));
            console.log("  Need to place ".concat(remainingSessions, " sessions with max ").concat(MAX_INTERVAL_DAYS, "-day interval"));
            // Check if there are existing sessions for this exam
            var existingSessionDates = [];
            var hasMultipleExams = this.inputs.exams.length > 1;
            if (this.inputs.existing_sessions && !hasMultipleExams) {
                // Only reuse existing sessions if this is a single exam
                // For multiple exams, always reschedule to apply diversification
                var availableDatesSet_1 = new Set(availableDays.map(function (d) { return d.toISOString().split('T')[0]; }));
                existingSessionDates = this.inputs.existing_sessions
                    .filter(function (s) { return s.subjectId === exam.id; })
                    .map(function (s) { return s.date.toISOString().split('T')[0]; })
                    .filter(function (dateStr) { return availableDatesSet_1.has(dateStr); });
            }
            // Check if this exam is isolated (has a large gap from earlier exams)
            // If isolated, treat it like a single exam and skip diversification rules
            var examDateStr_1 = exam.exam_date.toISOString().split('T')[0];
            var earlierExams = this.inputs.exams
                .filter(function (e) {
                if (e.id === exam.id)
                    return false;
                var eDate = e.exam_date.toISOString().split('T')[0];
                return eDate < examDateStr_1;
            })
                .sort(function (a, b) { return b.exam_date.getTime() - a.exam_date.getTime(); });
            // An exam is isolated ONLY if it has a large gap from the closest earlier OR same-day exam
            // If there are other exams on the same day or close by, it's NOT isolated
            var isIsolatedExam = false;
            // Check for same-day or close exams (within the session count + 2 days)
            var closeExams = this.inputs.exams.filter(function (e) {
                if (e.id === exam.id)
                    return false;
                var eDate = e.exam_date.toISOString().split('T')[0];
                var thisExamDateUTC = new Date(examDateStr_1 + 'T00:00:00.000Z');
                var otherExamDateUTC = new Date(eDate + 'T00:00:00.000Z');
                var daysDiff = Math.abs(Math.floor((thisExamDateUTC.getTime() - otherExamDateUTC.getTime()) / (24 * 60 * 60 * 1000)));
                // Consider exams within (totalSessions + 2) days as "close"
                return daysDiff < totalSessions + 2;
            });
            if (closeExams.length === 0 && earlierExams.length > 0) {
                // No close exams, but there are earlier exams - check if gap is large enough
                var closestEarlierExam = earlierExams[0];
                var earlierExamDateStr = closestEarlierExam.exam_date.toISOString().split('T')[0];
                var earlierExamDateUTC = new Date(earlierExamDateStr + 'T00:00:00.000Z');
                var thisExamDateUTC = new Date(examDateStr_1 + 'T00:00:00.000Z');
                var gapDays = Math.floor((thisExamDateUTC.getTime() - earlierExamDateUTC.getTime()) / (24 * 60 * 60 * 1000));
                if (gapDays >= totalSessions + 2) {
                    isIsolatedExam = true;
                    console.log("  \uD83C\uDFDD\uFE0F ".concat(exam.subject, " is ISOLATED (gap: ").concat(gapDays, " days from ").concat(closestEarlierExam.subject, ") - using single-exam distribution"));
                }
            }
            else if (closeExams.length === 0 && earlierExams.length === 0) {
                // No close exams and no earlier exams - check if there are ANY other exams
                var otherExams = this.inputs.exams.filter(function (e) { return e.id !== exam.id; });
                if (otherExams.length === 0) {
                    // Truly single exam
                    isIsolatedExam = true;
                    console.log("  \uD83C\uDFDD\uFE0F ".concat(exam.subject, " is ISOLATED (only exam) - using single-exam distribution"));
                }
                else {
                    // There are other exams but they're all later - treat as isolated
                    isIsolatedExam = true;
                    console.log("  \uD83C\uDFDD\uFE0F ".concat(exam.subject, " is ISOLATED (first exam, only later exams) - using single-exam distribution"));
                }
            }
            else {
                console.log("  ".concat(exam.subject, " has ").concat(closeExams.length, " close exam(s) - NOT isolated"));
            }
            if (hasMultipleExams && !isIsolatedExam) {
                console.log("  Multiple exams detected - applying diversification (not reusing existing sessions)");
            }
            else {
                console.log("  Existing session dates for ".concat(exam.subject, ":"), existingSessionDates);
            }
            var sessionCount = 0;
            // Only reuse existing sessions for single exam scenarios or isolated exams
            if (existingSessionDates.length > 0 && (!hasMultipleExams || isIsolatedExam)) {
                console.log("  Reusing ".concat(existingSessionDates.length, " existing session dates"));
                for (var _i = 0, existingSessionDates_1 = existingSessionDates; _i < existingSessionDates_1.length; _i++) {
                    var existingDate = existingSessionDates_1[_i];
                    if (sessionCount >= remainingSessions)
                        break;
                    sessionMap.set(existingDate, 1);
                    sessionCount++;
                    console.log("  \u2713 Placed session ".concat(sessionCount, "/").concat(remainingSessions, " on ").concat(existingDate, " (existing session)"));
                }
            }
            // Distribute sessions with diversification (spread across days, not all consecutive)
            if (sessionCount < remainingSessions) {
                var sessionsToPlace = remainingSessions - sessionCount;
                console.log("  Need to place ".concat(sessionsToPlace, " sessions (remaining: ").concat(remainingSessions, ", already placed: ").concat(sessionCount, ")"));
                console.log("  Total sessions should be: ".concat(totalSessions, " (including final review: ").concat(hasFinalReview, ")"));
                console.log("  Available days count: ".concat(availableDays.length, ", Sessions to place: ").concat(sessionsToPlace));
                console.log("  Distributing ".concat(sessionsToPlace, " sessions with diversification (max ").concat(MAX_INTERVAL_DAYS, "-day interval)"));
                var unassignedDays = availableDays.filter(function (d) { return !sessionMap.has(d.toISOString().split('T')[0]); });
                if (unassignedDays.length === 0) {
                    console.log("  No more available days");
                }
                else {
                    // Sort unassigned days chronologically
                    unassignedDays.sort(function (a, b) { return a.getTime() - b.getTime(); });
                    console.log("  Available unassigned days:", unassignedDays.map(function (d) { return d.toISOString().split('T')[0]; }));
                    // Get which days other exams are using
                    var otherExamDays_1 = new Set();
                    var prelimSchedules = this.preliminarySchedules;
                    prelimSchedules.forEach(function (schedule, examId) {
                        if (examId !== exam.id) {
                            schedule.forEach(function (sessions, dateStr) {
                                otherExamDays_1.add(dateStr);
                            });
                        }
                    });
                    console.log("  Days used by other exams:", Array.from(otherExamDays_1));
                    // Strategy: For isolated exams, use simple consecutive distribution
                    // For non-isolated exams, prefer days NOT used by other exams, max 2 consecutive sessions
                    var selectedDays = [];
                    var consecutiveCount = 0;
                    var lastSelectedDate = null;
                    // Work backwards from the latest available day
                    var reversedDays = __spreadArray([], unassignedDays, true).reverse();
                    // ── Bypass skipping if severely constrained (only when preferences ON) ──
                    // If we absolutely need every available day, skip the aesthetic constraints.
                    var tightlyConstrained = unassignedDays.length <= sessionsToPlace + 2;
                    var maxCrushSpan = 3; // Max consecutive sessions for diversification
                    if (isIsolatedExam) {
                        // ISOLATED EXAM: Simple consecutive distribution (like single-exam mode)
                        console.log("  Using simple consecutive distribution for isolated exam");
                        for (var _b = 0, reversedDays_1 = reversedDays; _b < reversedDays_1.length; _b++) {
                            var day = reversedDays_1[_b];
                            if (selectedDays.length >= sessionsToPlace)
                                break;
                            var dateStr = day.toISOString().split('T')[0];
                            if (lastSelectedDate === null) {
                                selectedDays.push(day);
                                lastSelectedDate = day;
                                console.log("  Selected ".concat(dateStr, " (first session)"));
                            }
                            else {
                                var daysDiff = Math.floor((lastSelectedDate.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
                                // Only respect max interval, no diversification rules
                                if (daysDiff <= MAX_INTERVAL_DAYS + 1) {
                                    selectedDays.push(day);
                                    lastSelectedDate = day;
                                    console.log("  Selected ".concat(dateStr, " (").concat(daysDiff, " days from last)"));
                                }
                                else {
                                    console.log("  Skipping ".concat(dateStr, " (would violate max interval: ").concat(daysDiff, " days)"));
                                }
                            }
                        }
                    }
                    else {
                        var _loop_2 = function (day) {
                            if (selectedDays.length >= sessionsToPlace) {
                                console.log("  Stopping: selected ".concat(selectedDays.length, " days, need ").concat(sessionsToPlace, " sessions"));
                                return "break";
                            }
                            var dateStr = day.toISOString().split('T')[0];
                            var isUsedByOther = otherExamDays_1.has(dateStr);
                            var tightlyConstrained_1 = unassignedDays.length <= sessionsToPlace + 2;
                            if (lastSelectedDate === null) {
                                // First session: always select
                                selectedDays.push(day);
                                lastSelectedDate = day;
                                consecutiveCount = 1;
                                console.log("  Selected ".concat(dateStr, " (first session, used by other: ").concat(isUsedByOther, ")"));
                            }
                            else {
                                var daysDiff = Math.floor((lastSelectedDate.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
                                var isConsecutive = daysDiff === 1;
                                // ── Hard gap constraint: if daysDiff already equals MAX_INTERVAL_DAYS+1
                                // (i.e. exactly 3 calendar days apart, which is the limit), we MUST
                                // select this day or the next one will exceed the limit.
                                var mustSelect = daysDiff >= MAX_INTERVAL_DAYS + 1;
                                if (mustSelect) {
                                    // We have no choice — select regardless of other-exam usage
                                    selectedDays.push(day);
                                    lastSelectedDate = day;
                                    consecutiveCount = isConsecutive ? consecutiveCount + 1 : 1;
                                    console.log("  FORCED: Selected ".concat(dateStr, " (gap would exceed limit: ").concat(daysDiff, " days, used by other: ").concat(isUsedByOther, ")"));
                                }
                                else if (daysDiff > MAX_INTERVAL_DAYS + 1) {
                                    // This day is already too far back — skip it entirely (gap already violated
                                    // without this day, which means we already selected what we needed earlier).
                                    // This branch should not normally be reached with mustSelect above.
                                    console.log("  Skipping ".concat(dateStr, " (too far: ").concat(daysDiff, " days from lastSelected)"));
                                }
                                else {
                                    // daysDiff <= MAX_INTERVAL_DAYS (within the comfortable window)
                                    // Max 3 consecutive sessions, unless tightly constrained
                                    if (isConsecutive && consecutiveCount >= 3 && !tightlyConstrained_1) {
                                        console.log("  Skipping ".concat(dateStr, " (would be 4th consecutive session)"));
                                        return "continue";
                                    }
                                    var daysRemaining = reversedDays.filter(function (d) { return d < day; }).length;
                                    var sessionsRemaining = sessionsToPlace - selectedDays.length - 1;
                                    var shouldSkip = isUsedByOther;
                                    // Only skip for diversification (or spreading) if there are enough days left AND
                                    // skipping won't push us too close to the gap limit.
                                    var safeToSkip = daysDiff < MAX_INTERVAL_DAYS && shouldSkip && daysRemaining >= sessionsRemaining * 1.5 && !tightlyConstrained_1;
                                    if (safeToSkip) {
                                        console.log("  Skipping ".concat(dateStr, " (shouldSkip=").concat(shouldSkip, ", daysDiff=").concat(daysDiff, ", ").concat(daysRemaining, " days left \u2014 safe)"));
                                        return "continue";
                                    }
                                    selectedDays.push(day);
                                    lastSelectedDate = day;
                                    consecutiveCount = isConsecutive ? consecutiveCount + 1 : 1;
                                    console.log("  Selected ".concat(dateStr, " (").concat(daysDiff, " days from last, consec: ").concat(consecutiveCount, ", used by other: ").concat(isUsedByOther, ")"));
                                }
                            }
                        };
                        // NON-ISOLATED EXAM: Apply diversification, but NEVER create a gap > MAX_INTERVAL_DAYS.
                        for (var _c = 0, reversedDays_2 = reversedDays; _c < reversedDays_2.length; _c++) {
                            var day = reversedDays_2[_c];
                            var state_1 = _loop_2(day);
                            if (state_1 === "break")
                                break;
                        }
                    }
                    // If we didn't get enough sessions, fill in the gaps
                    if (selectedDays.length < sessionsToPlace) {
                        console.log("  Only selected ".concat(selectedDays.length, "/").concat(sessionsToPlace, " sessions, filling gaps..."));
                        var _loop_3 = function (day) {
                            if (selectedDays.length >= sessionsToPlace)
                                return "break";
                            var dateStr = day.toISOString().split('T')[0];
                            if (!selectedDays.some(function (d) { return d.toISOString().split('T')[0] === dateStr; })) {
                                selectedDays.push(day);
                                console.log("  Added ".concat(dateStr, " to fill gap"));
                            }
                        };
                        for (var _d = 0, reversedDays_3 = reversedDays; _d < reversedDays_3.length; _d++) {
                            var day = reversedDays_3[_d];
                            var state_2 = _loop_3(day);
                            if (state_2 === "break")
                                break;
                        }
                    }
                    // CRITICAL FALLBACK: If we don't have enough selected days, add ALL remaining unassigned days
                    // This ensures all sessions are created even if diversification rules were too strict
                    if (selectedDays.length < Math.min(sessionsToPlace, unassignedDays.length)) {
                        console.log("  \u26A0\uFE0F Only selected ".concat(selectedDays.length, " days but need ").concat(sessionsToPlace, " sessions (").concat(unassignedDays.length, " available)"));
                        console.log("  Adding all remaining unassigned days to ensure all sessions are created");
                        var _loop_4 = function (day) {
                            var dateStr = day.toISOString().split('T')[0];
                            if (!selectedDays.some(function (d) { return d.toISOString().split('T')[0] === dateStr; })) {
                                selectedDays.push(day);
                                console.log("  Added ".concat(dateStr, " (now have ").concat(selectedDays.length, " days)"));
                            }
                        };
                        for (var _e = 0, reversedDays_4 = reversedDays; _e < reversedDays_4.length; _e++) {
                            var day = reversedDays_4[_e];
                            _loop_4(day);
                        }
                    }
                    // Place sessions on selected days
                    selectedDays.sort(function (a, b) { return a.getTime() - b.getTime(); }); // Sort chronologically
                    console.log("  Placing ".concat(selectedDays.length, " selected days, need ").concat(sessionsToPlace, " sessions"));
                    // If we don't have enough days, we need to place multiple sessions per day
                    var maxSessionsPerDay = this.getMaxSessionsPerDayForExamId(exam.id);
                    if (selectedDays.length < sessionsToPlace) {
                        console.log("  \u26A0\uFE0F  Not enough days (".concat(selectedDays.length, ") for sessions (").concat(sessionsToPlace, ")"));
                        console.log("  Will place multiple sessions per day - IGNORING daily limit to ensure all sessions are created");
                        console.log("  Selected days:", selectedDays.map(function (d) { return d.toISOString().split('T')[0]; }));
                        console.log("  Current sessionMap before placement:", Object.fromEntries(sessionMap));
                        console.log("  Current sessionCount: ".concat(sessionCount));
                        // Distribute sessions evenly across available days - ignore daily limit
                        var remainingToPlace = sessionsToPlace;
                        for (var i = 0; i < selectedDays.length && remainingToPlace > 0; i++) {
                            var day = selectedDays[i];
                            var dateStr = day.toISOString().split('T')[0];
                            console.log("  [Loop ".concat(i, "] Processing day ").concat(dateStr, ", remainingToPlace: ").concat(remainingToPlace));
                            // Calculate how many sessions to place on this day
                            var daysLeft = selectedDays.length - i;
                            var sessionsForThisDay = Math.ceil(remainingToPlace / daysLeft);
                            console.log("    daysLeft: ".concat(daysLeft, ", sessionsForThisDay: ").concat(sessionsForThisDay));
                            var currentSessions = sessionMap.get(dateStr) || 0;
                            var sessionsToAdd = sessionsForThisDay;
                            console.log("    currentSessions: ".concat(currentSessions, ", sessionsToAdd: ").concat(sessionsToAdd));
                            sessionMap.set(dateStr, currentSessions + sessionsToAdd);
                            sessionCount += sessionsToAdd;
                            remainingToPlace -= sessionsToAdd;
                            console.log("  \u2713 Placed ".concat(sessionsToAdd, " session(s) on ").concat(dateStr, " (total: ").concat(currentSessions + sessionsToAdd, ", remaining: ").concat(remainingToPlace, ")"));
                        }
                        console.log("  After multi-session placement, sessionMap:", Object.fromEntries(sessionMap));
                        console.log("  After multi-session placement, sessionCount: ".concat(sessionCount));
                    }
                    else {
                        // Normal case: enough days for 1 session per day
                        for (var _f = 0, selectedDays_1 = selectedDays; _f < selectedDays_1.length; _f++) {
                            var day = selectedDays_1[_f];
                            if (sessionCount >= remainingSessions) {
                                console.log("  Stopping: already placed ".concat(sessionCount, "/").concat(remainingSessions, " sessions"));
                                break;
                            }
                            var dateStr = day.toISOString().split('T')[0];
                            if (sessionMap.has(dateStr)) {
                                console.log("  Skipping ".concat(dateStr, " - already has a session"));
                                continue;
                            }
                            sessionMap.set(dateStr, 1);
                            sessionCount++;
                            console.log("  \u2713 Placed session ".concat(sessionCount, "/").concat(remainingSessions, " on ").concat(dateStr));
                        }
                    }
                }
            }
            // ── HARD RULE: enforce ≤ 3-day gap between consecutive sessions of this exam ──
            // Repeat until no violations remain (inserting a session inside each offending gap).
            // Use ALL valid slots (sortedSlots) as candidates, not just availableDays, so we can
            // fill gaps even in the excluded day-before-exam region.
            var availableDayStrSet = new Set(sortedSlots.map(function (d) { return d.toISOString().split('T')[0]; }));
            var fixIterations = 0;
            var MAX_FIX_ITERATIONS = 20; // safety valve
            while (fixIterations++ < MAX_FIX_ITERATIONS) {
                var sortedDates = Array.from(sessionMap.keys()).sort();
                var fixedAny = false;
                for (var i = 1; i < sortedDates.length; i++) {
                    var prevDateStr = sortedDates[i - 1];
                    var currDateStr = sortedDates[i];
                    var prevMs = new Date(prevDateStr).getTime();
                    var currMs = new Date(currDateStr).getTime();
                    var gapDays = Math.floor((currMs - prevMs) / (24 * 60 * 60 * 1000)) - 1; // empty days between
                    if (gapDays > MAX_INTERVAL_DAYS) {
                        console.log("  \u26A0 Gap violation: ".concat(gapDays, " empty days between ").concat(prevDateStr, " and ").concat(currDateStr, " \u2014 inserting session"));
                        // Find the best available day inside this gap
                        // Prefer days not already used by other exams, but ANY day in the gap is acceptable
                        var bestCandidate = null;
                        var bestIntensity = Infinity;
                        // Target: pick a day roughly in the middle of the gap so we split it evenly
                        var midMs = (prevMs + currMs) / 2;
                        var candidatesInGap = [];
                        for (var ms = prevMs + 24 * 60 * 60 * 1000; ms < currMs; ms += 24 * 60 * 60 * 1000) {
                            var candidateStr = new Date(ms).toISOString().split('T')[0];
                            if (availableDayStrSet.has(candidateStr) && !sessionMap.has(candidateStr)) {
                                candidatesInGap.push(candidateStr);
                            }
                        }
                        if (candidatesInGap.length === 0) {
                            console.log("  \u2717 No available slot in gap between ".concat(prevDateStr, " and ").concat(currDateStr, " \u2014 cannot fix"));
                            break; // nothing we can do for this gap
                        }
                        var _loop_5 = function (candidateStr) {
                            var intensity = 0;
                            this_2.preliminarySchedules.forEach(function (schedule, examId) {
                                if (examId !== exam.id && schedule.has(candidateStr)) {
                                    intensity += schedule.get(candidateStr) || 0;
                                }
                            });
                            var distFromMid = Math.abs(new Date(candidateStr).getTime() - midMs);
                            // Combine: score = intensity * 1e12 + distFromMid (so intensity dominates)
                            var score = intensity * 1e12 + distFromMid;
                            if (score < bestIntensity) {
                                bestIntensity = score;
                                bestCandidate = candidateStr;
                            }
                        };
                        var this_2 = this;
                        // Score candidates: prefer lower other-exam intensity, then closest to midpoint
                        for (var _g = 0, candidatesInGap_1 = candidatesInGap; _g < candidatesInGap_1.length; _g++) {
                            var candidateStr = candidatesInGap_1[_g];
                            _loop_5(candidateStr);
                        }
                        if (bestCandidate) {
                            sessionMap.set(bestCandidate, 1);
                            console.log("  \u2713 Inserted session on ".concat(bestCandidate, " to fix gap"));
                            fixedAny = true;
                            // Restart the gap-check loop from scratch since dates changed
                            break;
                        }
                    }
                }
                if (!fixedAny)
                    break; // no violations found (or none fixable)
            }
            // ── Final report ──
            console.log("  After gap enforcement: sessions on", Array.from(sessionMap.keys()).sort());
            // Note: gap-enforcement may have added extra sessions beyond the original totalSessions
            // calculation — that is intentional and correct. The ≤3-day hard rule takes priority
            // over session count targets, so we do NOT remove any sessions here.
            var totalAssigned_1 = 0;
            sessionMap.forEach(function (count) { return totalAssigned_1 += count; });
            console.log("  Final: ".concat(totalAssigned_1, " sessions total (target was ").concat(totalSessions, ", gap-enforcement may have added extras)"));
            if (totalAssigned_1 < totalSessions) {
                // Under-count is still a problem worth logging
                console.error("  WARNING: Only ".concat(totalAssigned_1, " sessions placed but ").concat(totalSessions, " were needed!"));
            }
        }
        console.log("Final session assignment for ".concat(exam.subject, ":"), Object.fromEntries(sessionMap));
        return sessionMap;
    };
    StudyPlannerV1.prototype.getPreliminarySchedule = function () {
        var result = {};
        var _loop_6 = function (exam) {
            var validSlots = this_3.generateValidSlotsForExam(exam);
            var sessionMap = this_3.assignSessionsEvenly(exam, validSlots);
            var dateSessionMap = {};
            sessionMap.forEach(function (sessions, date) {
                dateSessionMap[date] = sessions;
            });
            result[exam.subject] = dateSessionMap;
        };
        var this_3 = this;
        for (var _i = 0, _a = this.inputs.exams; _i < _a.length; _i++) {
            var exam = _a[_i];
            _loop_6(exam);
        }
        return result;
    };
    StudyPlannerV1.prototype.mergeExamsIntoDailyPlan = function () {
        var _this = this;
        var _a;
        console.log('=== UNIFIED SCORING ENGINE ===');
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var HARD_MAX_SESSIONS = Math.max(1, Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS));
        var MAX_INTERVAL_DAYS = 2; // max empty days between sessions for same exam
        // Build blocked days set
        var blockedSet = new Set(this.inputs.blocked_days || []);
        var examInfos = [];
        var allStudyDays = new Set();
        for (var _i = 0, _b = this.inputs.exams; _i < _b.length; _i++) {
            var exam = _b[_i];
            var completedHrs = ((_a = this.inputs.completed_hours) === null || _a === void 0 ? void 0 : _a[exam.id]) || 0;
            var totalHours = Math.max(0, this.calculateTotalHours(exam) - completedHrs);
            var sessionsNeeded = Math.ceil(totalHours / STUDY_CHUNK_HOURS);
            if (sessionsNeeded <= 0)
                continue;
            var validSlots = this.generateValidSlotsForExam(exam);
            var validDays = new Set(validSlots.map(function (d) { return d.toISOString().split('T')[0]; }));
            // Day before exam for final review
            var examDateStr = exam.exam_date.toISOString().split('T')[0];
            var examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
            var dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            validDays.forEach(function (d) { return allStudyDays.add(d); });
            examInfos.push({
                exam: exam,
                sessionsNeeded: sessionsNeeded,
                sessionsRemaining: sessionsNeeded,
                validDays: validDays,
                lastAssignedDay: null,
                dayBeforeExam: dayBeforeExam,
            });
            console.log("  ".concat(exam.subject, ": ").concat(sessionsNeeded, " sessions, ").concat(validDays.size, " valid days, exam: ").concat(examDateStr));
        }
        if (examInfos.length === 0) {
            return new Map();
        }
        // Sort study days chronologically
        var sortedDays = Array.from(allStudyDays).sort();
        var totalSessions = examInfos.reduce(function (sum, ei) { return sum + ei.sessionsNeeded; }, 0);
        var targetPerDay = Math.max(1, Math.ceil(totalSessions / sortedDays.length));
        // Clamp to hard max
        targetPerDay = Math.min(targetPerDay, HARD_MAX_SESSIONS);
        console.log("  Total sessions: ".concat(totalSessions, ", Study days: ").concat(sortedDays.length, ", Target/day: ").concat(targetPerDay));
        // ── Phase 2: Unified greedy assignment with scoring ──
        var schedule = new Map();
        // Initialize all days
        for (var _c = 0, sortedDays_1 = sortedDays; _c < sortedDays_1.length; _c++) {
            var day = sortedDays_1[_c];
            schedule.set(day, new Map());
        }
        // Helper: get total sessions on a day
        var dayLoad = function (day) {
            var dayMap = schedule.get(day);
            if (!dayMap)
                return 0;
            return Array.from(dayMap.values()).reduce(function (s, v) { return s + v; }, 0);
        };
        // Helper: get sessions of a specific exam on a day
        var examLoadOnDay = function (day, examId) {
            var _a;
            return ((_a = schedule.get(day)) === null || _a === void 0 ? void 0 : _a.get(examId)) || 0;
        };
        // Helper: days between two date strings
        var daysBetween = function (a, b) {
            return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000));
        };
        // Build set of all exam dates — avoid scheduling other exams on these days
        var examDatesSet = new Set();
        for (var _d = 0, _e = this.inputs.exams; _d < _e.length; _d++) {
            var exam = _e[_d];
            examDatesSet.add(exam.exam_date.toISOString().split('T')[0]);
        }
        // Main assignment: iterate through days in REVERSE (latest first)
        // This packs sessions near exam dates, not at the start of the study period.
        // We may need multiple passes if targetPerDay needs to increase.
        var totalAssigned = 0;
        var maxPasses = 5;
        // Reverse days for iteration (latest first, closest to exams)
        var reversedDays = __spreadArray([], sortedDays, true).reverse();
        while (totalAssigned < totalSessions && maxPasses > 0) {
            maxPasses--;
            var assignedThisPass = 0;
            for (var _f = 0, reversedDays_5 = reversedDays; _f < reversedDays_5.length; _f++) {
                var day = reversedDays_5[_f];
                if (blockedSet.has(day))
                    continue;
                while (dayLoad(day) < targetPerDay && totalAssigned < totalSessions) {
                    // Score each exam for this day
                    var bestExam = null;
                    var bestScore = -Infinity;
                    for (var _g = 0, examInfos_1 = examInfos; _g < examInfos_1.length; _g++) {
                        var ei = examInfos_1[_g];
                        if (ei.sessionsRemaining <= 0)
                            continue;
                        if (!ei.validDays.has(day))
                            continue;
                        var score = 0;
                        // P4: Final review bonus (day before exam gets priority)
                        if (day === ei.dayBeforeExam) {
                            score += 500;
                        }
                        // P5: Even distribution — higher score when day has fewer sessions
                        // (this naturally enforces the ±1 spread since we fill to targetPerDay)
                        score += 100 * (targetPerDay - dayLoad(day));
                        // P6: Gap urgency — based on nextAssignedDay (since we iterate backwards)
                        if (ei.lastAssignedDay !== null) {
                            // lastAssignedDay = the closest LATER day we already assigned to (we go backwards)
                            var gap = daysBetween(day, ei.lastAssignedDay);
                            var urgency = Math.min(gap, 5);
                            score += 50 * urgency;
                            // Strong push when gap exceeds limit
                            if (gap > MAX_INTERVAL_DAYS + 1) {
                                score += 300;
                            }
                        }
                        else {
                            // Exam hasn't been assigned yet — check how close the exam is
                            var examDateStr_2 = ei.exam.exam_date.toISOString().split('T')[0];
                            var daysToExam = daysBetween(day, examDateStr_2);
                            var daysNeeded = ei.sessionsRemaining;
                            if (daysToExam <= daysNeeded + 2) {
                                score += 200; // urgent: running out of days
                            }
                            else {
                                score += 50;
                            }
                        }
                        // P7: Diversification — penalty for same exam already on this day
                        if (examLoadOnDay(day, ei.exam.id) >= 1) {
                            score -= 300;
                        }
                        // Penalty: avoid scheduling on another exam's exam date
                        if (examDatesSet.has(day)) {
                            var examDateStr_3 = ei.exam.exam_date.toISOString().split('T')[0];
                            if (day !== examDateStr_3) {
                                // This day is some OTHER exam's exam date — avoid it
                                score -= 400;
                            }
                        }
                        // Tiebreaker: prefer exams with more sessions remaining
                        score += ei.sessionsRemaining * 2;
                        // Tiebreaker: prefer exams with earlier exam dates (more urgent)
                        var examDateStr = ei.exam.exam_date.toISOString().split('T')[0];
                        var proximity = daysBetween(day, examDateStr);
                        if (proximity <= 3) {
                            score += 30;
                        }
                        if (score > bestScore) {
                            bestScore = score;
                            bestExam = ei;
                        }
                    }
                    if (!bestExam || bestScore <= -100)
                        break; // no exam can go here
                    // Assign 1 session
                    var dayMap = schedule.get(day);
                    dayMap.set(bestExam.exam.id, (dayMap.get(bestExam.exam.id) || 0) + 1);
                    bestExam.sessionsRemaining--;
                    bestExam.lastAssignedDay = day; // tracks the earliest assigned day (going backwards)
                    totalAssigned++;
                    assignedThisPass++;
                    console.log("  Assigned ".concat(bestExam.exam.subject, " to ").concat(day, " (score: ").concat(bestScore, ", load: ").concat(dayLoad(day), ", remaining: ").concat(bestExam.sessionsRemaining, ")"));
                }
            }
            if (assignedThisPass === 0) {
                // No progress — increase targetPerDay and try again
                targetPerDay = Math.min(targetPerDay + 1, HARD_MAX_SESSIONS);
                console.log("  No progress, raising targetPerDay to ".concat(targetPerDay));
                if (targetPerDay >= HARD_MAX_SESSIONS && assignedThisPass === 0) {
                    console.log("  At HARD_MAX and still can't assign \u2014 some sessions may be dropped");
                    break;
                }
            }
        }
        var _loop_7 = function (ei) {
            var dayBefore = ei.dayBeforeExam;
            if (!schedule.has(dayBefore))
                return "continue";
            if (blockedSet.has(dayBefore))
                return "continue";
            var currentReview = examLoadOnDay(dayBefore, ei.exam.id);
            if (currentReview >= 1)
                return "continue"; // already has a session
            // Find the day with the MOST sessions of this exam (not the day before) to move one
            var bestSourceDay = null;
            var bestSourceCount = 0;
            schedule.forEach(function (dayMap, dateStr) {
                if (dateStr === dayBefore)
                    return;
                var count = dayMap.get(ei.exam.id) || 0;
                if (count > bestSourceCount) {
                    bestSourceCount = count;
                    bestSourceDay = dateStr;
                }
            });
            if (bestSourceDay && bestSourceCount > 0) {
                // Move 1 session to day before exam
                var sourceMap = schedule.get(bestSourceDay);
                sourceMap.set(ei.exam.id, sourceMap.get(ei.exam.id) - 1);
                if (sourceMap.get(ei.exam.id) === 0)
                    sourceMap.delete(ei.exam.id);
                var targetMap = schedule.get(dayBefore);
                targetMap.set(ei.exam.id, (targetMap.get(ei.exam.id) || 0) + 1);
                console.log("  Final review: moved ".concat(ei.exam.subject, " from ").concat(bestSourceDay, " to ").concat(dayBefore));
            }
        };
        // ── Phase 3: Ensure final review sessions ──
        for (var _h = 0, examInfos_2 = examInfos; _h < examInfos_2.length; _h++) {
            var ei = examInfos_2[_h];
            _loop_7(ei);
        }
        // ── Log final schedule ──
        console.log('=== FINAL UNIFIED SCHEDULE ===');
        var sortedFinal = Array.from(schedule.keys()).sort();
        for (var _j = 0, sortedFinal_1 = sortedFinal; _j < sortedFinal_1.length; _j++) {
            var day = sortedFinal_1[_j];
            var dayMap = schedule.get(day);
            var total = Array.from(dayMap.values()).reduce(function (s, v) { return s + v; }, 0);
            if (total > 0) {
                var exams = Array.from(dayMap.entries()).map(function (_a) {
                    var id = _a[0], count = _a[1];
                    var exam = _this.inputs.exams.find(function (e) { return e.id === id; });
                    return "".concat((exam === null || exam === void 0 ? void 0 : exam.subject) || id, ":").concat(count);
                }).join(', ');
                console.log("  ".concat(day, ": ").concat(total, " sessions (").concat(exams, ")"));
            }
        }
        // Log spread check
        var loads = sortedFinal.map(function (d) { return dayLoad(d); }).filter(function (l) { return l > 0; });
        if (loads.length > 0) {
            var min = Math.min.apply(Math, loads);
            var max = Math.max.apply(Math, loads);
            console.log("  Spread: min=".concat(min, ", max=").concat(max, ", diff=").concat(max - min, " ").concat(max - min <= 1 ? '✅' : '⚠️'));
        }
        // Remove empty days from the schedule
        for (var _k = 0, sortedFinal_2 = sortedFinal; _k < sortedFinal_2.length; _k++) {
            var day = sortedFinal_2[_k];
            if (dayLoad(day) === 0) {
                schedule.delete(day);
            }
        }
        return schedule;
    };
    StudyPlannerV1.prototype.addEmptyDaysToSchedule = function (mergedSchedule) {
        // Add empty days from the user's start_date to give the balancer and merge overflow
        // a full runway of available days. No filtering through per-exam valid slots here —
        // the balancer/overflow needs ALL calendar days, not just the compressed exam windows.
        var allDates = Array.from(mergedSchedule.keys()).sort();
        if (allDates.length === 0)
            return;
        var now = new Date();
        var nowStr = "".concat(now.getFullYear(), "-").concat(String(now.getMonth() + 1).padStart(2, '0'), "-").concat(String(now.getDate()).padStart(2, '0'));
        var nowUTC = new Date(nowStr + 'T00:00:00.000Z');
        var firstDateFromStart = new Date(this.inputs.start_date);
        firstDateFromStart.setHours(0, 0, 0, 0);
        // Never add days before today
        var firstDate = firstDateFromStart > nowUTC ? firstDateFromStart : nowUTC;
        var lastDate = new Date(allDates[allDates.length - 1] + 'T00:00:00.000Z');
        // Build blocked days set for quick lookup
        var blockedDays = new Set(this.inputs.blocked_days || []);
        var currentDate = new Date(firstDate);
        while (currentDate <= lastDate) {
            var dateStr = currentDate.toISOString().split('T')[0];
            if (!mergedSchedule.has(dateStr) && !blockedDays.has(dateStr)) {
                mergedSchedule.set(dateStr, new Map());
                console.log("Added empty day ".concat(dateStr, " to schedule for potential balancing"));
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    };
    StudyPlannerV1.prototype.balanceWorkload = function (mergedSchedule) {
        var _this = this;
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var HARD_MAX_SESSIONS = Math.max(1, Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS));
        // Compute ideal from actual schedule for even spreading (same for both ON and OFF)
        var MAX_SESSIONS_PER_DAY;
        {
            var totalSessions_1 = 0;
            mergedSchedule.forEach(function (daySchedule) {
                var daySessions = Array.from(daySchedule.values()).reduce(function (sum, s) { return sum + s; }, 0);
                totalSessions_1 += daySessions;
            });
            var totalDays = mergedSchedule.size;
            var idealPerDay = Math.max(1, Math.ceil(totalSessions_1 / Math.max(1, totalDays)));
            MAX_SESSIONS_PER_DAY = Math.min(idealPerDay, HARD_MAX_SESSIONS);
            console.log("\uD83D\uDCCA Balance: total=".concat(totalSessions_1, ", days=").concat(totalDays, ", idealPerDay=").concat(idealPerDay, ", effectiveMax=").concat(MAX_SESSIONS_PER_DAY));
        }
        // Helper: would moving a session of examId from sourceDate to targetDate create a gap > 2 empty days (MAX_INTERVAL_DAYS)?
        // Checks that removing from sourceDate AND adding to targetDate both respect the consecutive gap limit.
        var wouldMoveCreateGapViolation = function (examId, sourceDate, targetDate) {
            var _a;
            var examSessionDates = Array.from(mergedSchedule.entries())
                .filter(function (_a) {
                var date = _a[0], sched = _a[1];
                return sched.has(examId) && (sched.get(examId) || 0) > 0;
            })
                .map(function (_a) {
                var date = _a[0];
                return date;
            });
            // Simulate removal
            var sourceSessions = ((_a = mergedSchedule.get(sourceDate)) === null || _a === void 0 ? void 0 : _a.get(examId)) || 0;
            var afterMove = sourceSessions <= 1
                ? examSessionDates.filter(function (d) { return d !== sourceDate; })
                : __spreadArray([], examSessionDates, true);
            // Simulate addition
            if (!afterMove.includes(targetDate)) {
                afterMove.push(targetDate);
            }
            afterMove.sort();
            if (afterMove.length < 2)
                return false;
            var _loop_11 = function (k) {
                var gap = Math.floor((new Date(afterMove[k]).getTime() - new Date(afterMove[k - 1]).getTime()) /
                    (24 * 60 * 60 * 1000)) - 1;
                // Only widen gap to 4 when exam >= 14 days away AND schedule has days exceeding soft limit
                var examMaxGap = 2;
                var eState = _this.subjects.find(function (s) { return s.id === examId; });
                if (eState) {
                    var daysUntil = Math.floor((eState.exam_date.getTime() - new Date().setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000));
                    var softLimitSessions_1 = Math.max(1, Math.floor(_this.getEffectiveSoftLimit() / (_this.inputs.session_duration / 60)));
                    var hasDenseDays = Array.from(mergedSchedule.values()).some(function (day) {
                        return Array.from(day.values()).reduce(function (sum, s) { return sum + s; }, 0) > softLimitSessions_1;
                    });
                    if (daysUntil >= 14 && hasDenseDays) {
                        examMaxGap = 4;
                    }
                }
                if (gap > examMaxGap)
                    return { value: true };
            };
            for (var k = 1; k < afterMove.length; k++) {
                var state_4 = _loop_11(k);
                if (typeof state_4 === "object")
                    return state_4.value;
            }
            return false;
        };
        // Get all dates in chronological order
        var allDates = Array.from(mergedSchedule.keys()).sort();
        console.log('=== BALANCING WORKLOAD ===');
        console.log('Max sessions per day:', MAX_SESSIONS_PER_DAY);
        // Find overloaded, busy, and underloaded days
        var overloadedDays = [];
        var busyDays = [];
        var underloadedDays = [];
        allDates.forEach(function (date) {
            var daySchedule = mergedSchedule.get(date);
            var totalSessions = Array.from(daySchedule.values()).reduce(function (sum, s) { return sum + s; }, 0);
            console.log("Day ".concat(date, ": ").concat(totalSessions, " sessions"), Object.fromEntries(daySchedule));
            if (totalSessions > MAX_SESSIONS_PER_DAY) {
                overloadedDays.push({
                    date: date,
                    totalSessions: totalSessions,
                    excess: totalSessions - MAX_SESSIONS_PER_DAY
                });
                console.log("  -> OVERLOADED by ".concat(totalSessions - MAX_SESSIONS_PER_DAY, " sessions"));
            }
            else if (totalSessions === MAX_SESSIONS_PER_DAY) {
                // Busy days can give up 1 session if there are empty days that need sessions
                busyDays.push({
                    date: date,
                    totalSessions: totalSessions,
                    canGive: 1
                });
                console.log("  -> BUSY (can give 1 session if needed)");
            }
            else if (totalSessions < MAX_SESSIONS_PER_DAY) {
                underloadedDays.push({
                    date: date,
                    totalSessions: totalSessions,
                    capacity: MAX_SESSIONS_PER_DAY - totalSessions
                });
                console.log("  -> UNDERLOADED with ".concat(MAX_SESSIONS_PER_DAY - totalSessions, " capacity"));
            }
        });
        console.log("Found ".concat(overloadedDays.length, " overloaded days, ").concat(busyDays.length, " busy days, ").concat(underloadedDays.length, " underloaded days"));
        var _loop_8 = function (overloadedDay) {
            var daySchedule = mergedSchedule.get(overloadedDay.date);
            var excessToMove = overloadedDay.excess;
            console.log("Processing overloaded day ".concat(overloadedDay.date, ", need to move ").concat(excessToMove, " sessions"));
            var _loop_12 = function (underloadedDay) {
                if (excessToMove <= 0)
                    return "break";
                var capacity = underloadedDay.capacity;
                var sessionsToMove = Math.min(excessToMove, capacity);
                console.log("  Trying to move to underloaded day ".concat(underloadedDay.date, " (capacity: ").concat(capacity, ")"));
                // Find exams with sessions on the overloaded day
                var examIds = Array.from(daySchedule.keys()).filter(function (examId) {
                    return daySchedule.get(examId) > 0;
                });
                console.log("  Available exams on overloaded day:", examIds);
                var _loop_13 = function (examId) {
                    if (sessionsToMove <= 0)
                        return "break";
                    var exam = this_4.inputs.exams.find(function (e) { return e.id === examId; });
                    if (!exam)
                        return "continue";
                    console.log("    Checking exam ".concat(exam.subject, " (exam date: ").concat(exam.exam_date.toISOString().split('T')[0], ")"));
                    // Check if this is a final review session (day before exam) - don't move it
                    var examDateStr = exam.exam_date.toISOString().split('T')[0];
                    var examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
                    var dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
                    var dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
                    if (overloadedDay.date === dayBeforeExamStr && daySchedule.get(examId) <= 1) {
                        console.log("    SKIP: ".concat(overloadedDay.date, " is day before exam for ").concat(exam.subject, ", protecting final review session"));
                        return "continue";
                    }
                    // Check if we can move a session to the underloaded day
                    var validSlots = this_4.generateValidSlotsForExam(exam);
                    var isValidDate = validSlots.some(function (slot) {
                        return slot.toISOString().split('T')[0] === underloadedDay.date;
                    });
                    if (!isValidDate) {
                        console.log("    Can't move to ".concat(underloadedDay.date, ": not a valid date for ").concat(exam.subject));
                        return "continue";
                    }
                    // Check subject diversification - max 1 session of same exam per target day
                    var underloadedSchedule = mergedSchedule.get(underloadedDay.date) || new Map();
                    var currentCountOnTarget = underloadedSchedule.get(examId) || 0;
                    if (currentCountOnTarget >= 2) {
                        console.log("    SKIP: ".concat(exam.subject, " already has ").concat(currentCountOnTarget, " session on ").concat(underloadedDay.date, ", avoiding tripling"));
                        return "continue";
                    }
                    if (wouldMoveCreateGapViolation(examId, overloadedDay.date, underloadedDay.date)) {
                        console.log("    SKIP: moving ".concat(exam.subject, " from ").concat(overloadedDay.date, " to ").concat(underloadedDay.date, " would create gap violation"));
                        return "continue";
                    }
                    // Move 1 session from overloaded to underloaded day
                    daySchedule.set(examId, daySchedule.get(examId) - 1);
                    if (!mergedSchedule.has(underloadedDay.date)) {
                        mergedSchedule.set(underloadedDay.date, new Map());
                    }
                    var targetSchedule = mergedSchedule.get(underloadedDay.date);
                    targetSchedule.set(examId, (targetSchedule.get(examId) || 0) + 1);
                    console.log("    MOVED 1 session of ".concat(exam.subject, " from ").concat(overloadedDay.date, " to ").concat(underloadedDay.date));
                    excessToMove--;
                    underloadedDay.capacity--;
                    sessionsToMove--;
                    // Remove empty exam entries
                    if (daySchedule.get(examId) === 0) {
                        daySchedule.delete(examId);
                    }
                };
                // Move sessions one by one, prioritizing exams with furthest exam dates
                for (var _c = 0, examIds_1 = examIds; _c < examIds_1.length; _c++) {
                    var examId = examIds_1[_c];
                    var state_6 = _loop_13(examId);
                    if (state_6 === "break")
                        break;
                }
            };
            // Try to move sessions to underloaded days
            for (var _b = 0, underloadedDays_1 = underloadedDays; _b < underloadedDays_1.length; _b++) {
                var underloadedDay = underloadedDays_1[_b];
                var state_5 = _loop_12(underloadedDay);
                if (state_5 === "break")
                    break;
            }
        };
        var this_4 = this;
        // First, handle overloaded days
        for (var _i = 0, overloadedDays_1 = overloadedDays; _i < overloadedDays_1.length; _i++) {
            var overloadedDay = overloadedDays_1[_i];
            _loop_8(overloadedDay);
        }
        // Then, handle busy days - move 1 session from busy days to very empty days
        if (busyDays.length > 0 && underloadedDays.length > 0) {
            console.log('=== BALANCING BUSY DAYS ===');
            var _loop_9 = function (busyDay) {
                var daySchedule = mergedSchedule.get(busyDay.date);
                // Find very empty days (1 session or less)
                var veryEmptyDays = underloadedDays.filter(function (day) {
                    return day.totalSessions <= 1 && day.capacity >= 1;
                });
                if (veryEmptyDays.length === 0)
                    return "continue";
                console.log("Processing busy day ".concat(busyDay.date, ", can give ").concat(busyDay.canGive, " session"));
                // Find exams with sessions on the busy day (prioritize exams with furthest exam dates)
                var examIds = Array.from(daySchedule.keys()).filter(function (examId) {
                    return daySchedule.get(examId) > 0;
                });
                // Sort by exam date (furthest first)
                examIds.sort(function (a, b) {
                    var examA = _this.inputs.exams.find(function (e) { return e.id === a; });
                    var examB = _this.inputs.exams.find(function (e) { return e.id === b; });
                    return examB.exam_date.getTime() - examA.exam_date.getTime();
                });
                console.log("  Available exams on busy day:", examIds.map(function (id) {
                    var exam = _this.inputs.exams.find(function (e) { return e.id === id; });
                    return exam.subject;
                }));
                var _loop_14 = function (examId) {
                    if (busyDay.canGive <= 0)
                        return "break";
                    var exam = this_5.inputs.exams.find(function (e) { return e.id === examId; });
                    if (!exam)
                        return "continue";
                    console.log("    Checking exam ".concat(exam.subject, " (exam date: ").concat(exam.exam_date.toISOString().split('T')[0], ")"));
                    // Check if this is a final review session (day before exam) - don't move it
                    var examDateStr = exam.exam_date.toISOString().split('T')[0];
                    var examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
                    var dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
                    var dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
                    if (busyDay.date === dayBeforeExamStr && daySchedule.get(examId) <= 1) {
                        console.log("    SKIP: ".concat(busyDay.date, " is day before exam for ").concat(exam.subject, ", protecting final review session"));
                        return "continue";
                    }
                    var _loop_15 = function (emptyDay) {
                        if (busyDay.canGive <= 0)
                            return "break";
                        // Check if we can move a session to the empty day
                        var validSlots = this_5.generateValidSlotsForExam(exam);
                        var isValidDate = validSlots.some(function (slot) {
                            return slot.toISOString().split('T')[0] === emptyDay.date;
                        });
                        if (!isValidDate) {
                            console.log("    Can't move to ".concat(emptyDay.date, ": not a valid date for ").concat(exam.subject));
                            return "continue";
                        }
                        // Check subject diversification - max 1 session of same exam per target day
                        var emptyDaySchedule = mergedSchedule.get(emptyDay.date) || new Map();
                        var currentCountOnTarget = emptyDaySchedule.get(examId) || 0;
                        if (currentCountOnTarget >= 2) {
                            console.log("    SKIP: ".concat(exam.subject, " already has ").concat(currentCountOnTarget, " session on ").concat(emptyDay.date, ", avoiding tripling"));
                            return "continue";
                        }
                        // HARD CHECK: moving from busyDay must not create a gap > 3 days for this exam
                        if (wouldMoveCreateGapViolation(examId, busyDay.date, emptyDay.date)) {
                            console.log("    SKIP: moving ".concat(exam.subject, " from ").concat(busyDay.date, " to ").concat(emptyDay.date, " would create gap violation"));
                            return "continue";
                        }
                        // Move 1 session from busy to empty day
                        daySchedule.set(examId, daySchedule.get(examId) - 1);
                        if (!mergedSchedule.has(emptyDay.date)) {
                            mergedSchedule.set(emptyDay.date, new Map());
                        }
                        var targetSchedule = mergedSchedule.get(emptyDay.date);
                        targetSchedule.set(examId, (targetSchedule.get(examId) || 0) + 1);
                        console.log("    MOVED 1 session of ".concat(exam.subject, " from ").concat(busyDay.date, " to ").concat(emptyDay.date));
                        busyDay.canGive--;
                        emptyDay.capacity--;
                        emptyDay.totalSessions++;
                        // Remove empty exam entries
                        if (daySchedule.get(examId) === 0) {
                            daySchedule.delete(examId);
                        }
                        return "break";
                    };
                    // Try to move to very empty days
                    for (var _e = 0, veryEmptyDays_1 = veryEmptyDays; _e < veryEmptyDays_1.length; _e++) {
                        var emptyDay = veryEmptyDays_1[_e];
                        var state_8 = _loop_15(emptyDay);
                        if (state_8 === "break")
                            break;
                    }
                };
                for (var _d = 0, examIds_2 = examIds; _d < examIds_2.length; _d++) {
                    var examId = examIds_2[_d];
                    var state_7 = _loop_14(examId);
                    if (state_7 === "break")
                        break;
                }
            };
            var this_5 = this;
            for (var _a = 0, busyDays_1 = busyDays; _a < busyDays_1.length; _a++) {
                var busyDay = busyDays_1[_a];
                _loop_9(busyDay);
            }
        }
        // Additional balancing phase: even out workload across all days
        // Move sessions from heavier days to lighter days for better distribution
        console.log('=== EVENING OUT WORKLOAD ===');
        // Sort days by session count (heaviest first)
        var daysByLoad = allDates.map(function (date) { return ({
            date: date,
            sessions: Array.from(mergedSchedule.get(date).values()).reduce(function (sum, s) { return sum + s; }, 0)
        }); }).sort(function (a, b) { return b.sessions - a.sessions; });
        // Try to balance: move from heavy days to light days
        for (var i = 0; i < daysByLoad.length; i++) {
            var heavyDay = daysByLoad[i];
            if (heavyDay.sessions <= 2)
                break; // Stop if we reach days with 2 or fewer sessions
            var _loop_10 = function (j) {
                var lightDay = daysByLoad[j];
                // Only balance if there's a significant difference (2+ sessions)
                if (heavyDay.sessions - lightDay.sessions < 2)
                    return "continue";
                var heavySchedule = mergedSchedule.get(heavyDay.date);
                var lightSchedule = mergedSchedule.get(lightDay.date) || new Map();
                // Don't create a day with too many sessions (respect daily max)
                var STUDY_CHUNK_HRS = this_6.inputs.session_duration / 60;
                var currentOnLightTotal = Array.from(lightSchedule.values()).reduce(function (s, v) { return s + v; }, 0);
                // Note: The global max is already checked by checking if currentOnLightTotal >= global maxPerDay
                var globalMaxPerDay = Math.floor(this_6.inputs.daily_max_hours / STUDY_CHUNK_HRS);
                if (currentOnLightTotal >= globalMaxPerDay)
                    return "continue";
                // Try to move one session from heavy to light day
                var examIds = Array.from(heavySchedule.keys()).filter(function (id) { return heavySchedule.get(id) > 0; });
                var _loop_16 = function (examId) {
                    var exam = this_6.inputs.exams.find(function (e) { return e.id === examId; });
                    if (!exam)
                        return "continue";
                    // Check if this is a final review session - don't move it
                    var examDateStr = exam.exam_date.toISOString().split('T')[0];
                    var examDateUTC = new Date(examDateStr + 'T00:00:00.000Z');
                    var dayBeforeExam = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000);
                    var dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
                    if (heavyDay.date === dayBeforeExamStr && heavySchedule.get(examId) <= 1)
                        return "continue";
                    // Check if light day is valid for this exam
                    var validSlots = this_6.generateValidSlotsForExam(exam);
                    var isValid = validSlots.some(function (slot) { return slot.toISOString().split('T')[0] === lightDay.date; });
                    if (!isValid)
                        return "continue";
                    // Check diversification (max 1 of same exam per day after move) AND specific exam cap
                    var currentOnLight = lightSchedule.get(examId) || 0;
                    var maxForThisExam = this_6.getMaxSessionsPerDayForExamId(examId);
                    // Strictly diversify: max 1 session of the same exam per day during balancing
                    var diversificationLimit = Math.min(1, maxForThisExam);
                    if (currentOnLight >= diversificationLimit)
                        return "continue"; // check allowed sessions of same exam on target day
                    // HARD CHECK: moving from heavyDay must not create a gap > 3 days for this exam
                    if (wouldMoveCreateGapViolation(examId, heavyDay.date, lightDay.date)) {
                        console.log("  Skip move of ".concat(exam.subject, " from ").concat(heavyDay.date, " to ").concat(lightDay.date, " \u2192 gap violation"));
                        return "continue";
                    }
                    // Move the session
                    heavySchedule.set(examId, heavySchedule.get(examId) - 1);
                    if (!mergedSchedule.has(lightDay.date)) {
                        mergedSchedule.set(lightDay.date, new Map());
                    }
                    mergedSchedule.get(lightDay.date).set(examId, currentOnLight + 1);
                    console.log("  Balanced: moved ".concat(exam.subject, " from ").concat(heavyDay.date, " (").concat(heavyDay.sessions, "\u2192").concat(heavyDay.sessions - 1, ") to ").concat(lightDay.date, " (").concat(lightDay.sessions, "\u2192").concat(lightDay.sessions + 1, ")"));
                    // Update counts
                    heavyDay.sessions--;
                    lightDay.sessions++;
                    if (heavySchedule.get(examId) === 0) {
                        heavySchedule.delete(examId);
                    }
                    return "break";
                };
                for (var _f = 0, examIds_3 = examIds; _f < examIds_3.length; _f++) {
                    var examId = examIds_3[_f];
                    var state_9 = _loop_16(examId);
                    if (state_9 === "break")
                        break;
                }
                if (heavyDay.sessions <= 2)
                    return "break";
            };
            var this_6 = this;
            // Find lighter days that could take a session
            for (var j = daysByLoad.length - 1; j > i; j--) {
                var state_3 = _loop_10(j);
                if (state_3 === "break")
                    break;
            }
        }
        console.log('=== FINAL BALANCED SCHEDULE ===');
        allDates.forEach(function (date) {
            var daySchedule = mergedSchedule.get(date);
            var totalSessions = Array.from(daySchedule.values()).reduce(function (sum, s) { return sum + s; }, 0);
            console.log("Day ".concat(date, ": ").concat(totalSessions, " sessions"), Object.fromEntries(daySchedule));
        });
    };
    // Strict ±1 enforcement — runs LAST, after all other balancing and interval fixes.
    StudyPlannerV1.prototype.enforceMaxOneDifference = function (mergedSchedule) {
        var _this = this;
        console.log('=== ENFORCING ±1 SESSION RULE ===');
        var allDates = Array.from(mergedSchedule.keys()).sort();
        // Gap violation checker — RELAXED for ±1 enforcement (allow up to 4 empty days
        // between sessions instead of 2, since even distribution is the priority here).
        var wouldCreateGapViolation = function (examId, sourceDate, targetDate) {
            var _a;
            var examSessionDates = Array.from(mergedSchedule.entries())
                .filter(function (_a) {
                var sched = _a[1];
                return sched.has(examId) && (sched.get(examId) || 0) > 0;
            })
                .map(function (_a) {
                var date = _a[0];
                return date;
            });
            var sourceSessions = ((_a = mergedSchedule.get(sourceDate)) === null || _a === void 0 ? void 0 : _a.get(examId)) || 0;
            var afterMove = sourceSessions <= 1
                ? examSessionDates.filter(function (d) { return d !== sourceDate; })
                : __spreadArray([], examSessionDates, true);
            if (!afterMove.includes(targetDate))
                afterMove.push(targetDate);
            afterMove.sort();
            if (afterMove.length < 2)
                return false;
            // Relaxed: allow up to 4 empty days (5 calendar days) for ±1 enforcement
            var RELAXED_MAX_GAP = 4;
            for (var k = 1; k < afterMove.length; k++) {
                var gap = Math.floor((new Date(afterMove[k]).getTime() - new Date(afterMove[k - 1]).getTime()) / (24 * 60 * 60 * 1000)) - 1;
                if (gap > RELAXED_MAX_GAP)
                    return true;
            }
            return false;
        };
        var round = 0;
        var _loop_17 = function () {
            round++;
            var loads = allDates.map(function (date) {
                var sched = mergedSchedule.get(date);
                return { date: date, sessions: Array.from(sched.values()).reduce(function (s, v) { return s + v; }, 0) };
            });
            var minLoad = Math.min.apply(Math, loads.map(function (l) { return l.sessions; }));
            var maxLoad = Math.max.apply(Math, loads.map(function (l) { return l.sessions; }));
            if (maxLoad - minLoad <= 1) {
                console.log("  \u00B11 rule satisfied (min=".concat(minLoad, ", max=").concat(maxLoad, ") after ").concat(round - 1, " moves"));
                return "break";
            }
            console.log("  Round ".concat(round, ": spread=").concat(maxLoad - minLoad, " (min=").concat(minLoad, ", max=").concat(maxLoad, ")"));
            // Try ALL heavy days
            var heavyDays = loads.filter(function (l) { return l.sessions === maxLoad; });
            // Try ANY day lighter than maxLoad-1 (not just minLoad days)
            var candidateTargets = loads
                .filter(function (l) { return l.sessions < maxLoad - 1; })
                .sort(function (a, b) { return a.sessions - b.sessions; }); // lightest first
            var moved = false;
            var _loop_18 = function (heaviest) {
                if (moved)
                    return "break";
                var heavySchedule = mergedSchedule.get(heaviest.date);
                var examIds = Array.from(heavySchedule.keys()).filter(function (id) { return (heavySchedule.get(id) || 0) > 0; });
                var _loop_19 = function (examId) {
                    if (moved)
                        return "break";
                    var exam = this_7.inputs.exams.find(function (e) { return e.id === examId; });
                    if (!exam)
                        return "continue";
                    // Don't move final review (day before exam)
                    var examDateUTC = new Date(exam.exam_date.toISOString().split('T')[0] + 'T00:00:00.000Z');
                    var dayBeforeStr = new Date(examDateUTC.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    if (heaviest.date === dayBeforeStr && heavySchedule.get(examId) <= 1) {
                        console.log("  Skip ".concat(exam.subject, " on ").concat(heaviest.date, ": final review day"));
                        return "continue";
                    }
                    // Try ALL candidate target days for this exam
                    for (var _c = 0, candidateTargets_1 = candidateTargets; _c < candidateTargets_1.length; _c++) {
                        var target = candidateTargets_1[_c];
                        if (moved)
                            break;
                        var targetDateUTC = new Date(target.date + 'T00:00:00.000Z');
                        // Can this exam study on the target day? (before exam date)
                        var lastValidDay = new Date(examDateUTC);
                        if (!exam.can_study_after_exam)
                            lastValidDay.setDate(lastValidDay.getDate() - 1);
                        if (targetDateUTC > lastValidDay) {
                            console.log("  Skip ".concat(exam.subject, " \u2192 ").concat(target.date, ": after exam ").concat(exam.exam_date.toISOString().split('T')[0]));
                            continue;
                        }
                        // Target day must be >= today
                        var now = new Date();
                        var nowStr = "".concat(now.getFullYear(), "-").concat(String(now.getMonth() + 1).padStart(2, '0'), "-").concat(String(now.getDate()).padStart(2, '0'));
                        if (target.date < nowStr)
                            continue;
                        // Diversification: max 1 of same exam on target
                        var targetSchedule = mergedSchedule.get(target.date) || new Map();
                        if ((targetSchedule.get(examId) || 0) >= 1) {
                            console.log("  Skip ".concat(exam.subject, " \u2192 ").concat(target.date, ": already has this exam"));
                            continue;
                        }
                        // NO gap violation check — ±1 distribution is the priority.
                        // Earlier steps already enforce gap constraints.
                        // Move the session
                        heavySchedule.set(examId, heavySchedule.get(examId) - 1);
                        if (heavySchedule.get(examId) === 0)
                            heavySchedule.delete(examId);
                        if (!mergedSchedule.has(target.date))
                            mergedSchedule.set(target.date, new Map());
                        var targetSched = mergedSchedule.get(target.date);
                        targetSched.set(examId, (targetSched.get(examId) || 0) + 1);
                        console.log("  \u00B11: moved ".concat(exam.subject, " from ").concat(heaviest.date, " (").concat(maxLoad, "\u2192").concat(maxLoad - 1, ") to ").concat(target.date, " (").concat(target.sessions, "\u2192").concat(target.sessions + 1, ")"));
                        moved = true;
                    }
                };
                for (var _b = 0, examIds_4 = examIds; _b < examIds_4.length; _b++) {
                    var examId = examIds_4[_b];
                    var state_12 = _loop_19(examId);
                    if (state_12 === "break")
                        break;
                }
            };
            for (var _i = 0, heavyDays_1 = heavyDays; _i < heavyDays_1.length; _i++) {
                var heaviest = heavyDays_1[_i];
                var state_11 = _loop_18(heaviest);
                if (state_11 === "break")
                    break;
            }
            if (!moved) {
                console.log("  Cannot fully satisfy \u00B11 rule (min=".concat(minLoad, ", max=").concat(maxLoad, ") \u2014 no valid moves remain"));
                // Log all exams on heavy days and their constraints
                for (var _a = 0, heavyDays_2 = heavyDays; _a < heavyDays_2.length; _a++) {
                    var h = heavyDays_2[_a];
                    var hs = mergedSchedule.get(h.date);
                    var exams = Array.from(hs.keys()).map(function (id) {
                        var e = _this.inputs.exams.find(function (ex) { return ex.id === id; });
                        return e ? "".concat(e.subject, "(exam:").concat(e.exam_date.toISOString().split('T')[0], ")") : id;
                    });
                    console.log("    Heavy ".concat(h.date, " (").concat(h.sessions, "): ").concat(exams.join(', ')));
                }
                return "break";
            }
        };
        var this_7 = this;
        while (round < 100) {
            var state_10 = _loop_17();
            if (state_10 === "break")
                break;
        }
        // Log final state
        console.log('=== FINAL SCHEDULE AFTER ±1 ENFORCEMENT ===');
        allDates.forEach(function (date) {
            var daySchedule = mergedSchedule.get(date);
            var totalSessions = Array.from(daySchedule.values()).reduce(function (sum, s) { return sum + s; }, 0);
            console.log("Day ".concat(date, ": ").concat(totalSessions, " sessions"), Object.fromEntries(daySchedule));
        });
    };
    StudyPlannerV1.prototype.fixMaxIntervalViolations = function (mergedSchedule) {
        var _this = this;
        console.log('=== FIXING MAX INTERVAL VIOLATIONS ===');
        // Check each exam's sessions for violations
        this.inputs.exams.forEach(function (exam) {
            // Get all dates where this exam has sessions
            var examDates = [];
            // Only widen gap to 4 when exam >= 14 days away AND schedule has days exceeding soft limit
            var daysUntil = Math.floor((exam.exam_date.getTime() - new Date().setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000));
            var STUDY_CHUNK_HOURS = _this.inputs.session_duration / 60;
            var softLimitSessions = Math.max(1, Math.floor(_this.getEffectiveSoftLimit() / STUDY_CHUNK_HOURS));
            var hasDenseDays = Array.from(mergedSchedule.values()).some(function (day) {
                return Array.from(day.values()).reduce(function (sum, s) { return sum + s; }, 0) > softLimitSessions;
            });
            var examMaxGap = (daysUntil >= 14 && hasDenseDays) ? 4 : 2;
            mergedSchedule.forEach(function (daySchedule, date) {
                if (daySchedule.has(exam.id) && daySchedule.get(exam.id) > 0) {
                    examDates.push(date);
                }
            });
            examDates.sort();
            if (examDates.length < 2)
                return; // No violation possible with < 2 sessions
            console.log("Checking ".concat(exam.subject, ": ").concat(examDates.join(', ')));
            var _loop_20 = function (i) {
                var prevDate = new Date(examDates[i - 1]);
                var currDate = new Date(examDates[i]);
                var gap = Math.floor((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)) - 1;
                if (gap > examMaxGap) {
                    console.log("  \u26A0 Violation: ".concat(gap, " days gap between ").concat(examDates[i - 1], " and ").concat(examDates[i]));
                    // Try to move the first session to fill the gap
                    var firstSessionDate = examDates[0];
                    var secondSessionDate_1 = examDates[1];
                    // Find available days between second and the violating session
                    var allDates = Array.from(mergedSchedule.keys()).sort();
                    var availableDays = allDates.filter(function (date) {
                        var daySchedule = mergedSchedule.get(date);
                        var hasThisExam = daySchedule.has(exam.id) && daySchedule.get(exam.id) > 0;
                        return !hasThisExam && date > secondSessionDate_1 && date < examDates[i];
                    });
                    if (availableDays.length > 0) {
                        // Calculate intensity for each available day
                        var bestDay = null;
                        var lowestIntensity = Infinity;
                        // Get valid slots for this exam to ensure we only move to valid days
                        var validSlots = _this.generateValidSlotsForExam(exam);
                        var validDatesSet = new Set(validSlots.map(function (s) { return s.toISOString().split('T')[0]; }));
                        for (var _i = 0, availableDays_1 = availableDays; _i < availableDays_1.length; _i++) {
                            var day = availableDays_1[_i];
                            // Skip if this day is not valid for this exam
                            if (!validDatesSet.has(day)) {
                                console.log("    Skipping ".concat(day, " - not valid for ").concat(exam.subject));
                                continue;
                            }
                            var daySchedule = mergedSchedule.get(day);
                            var intensity = Array.from(daySchedule.values()).reduce(function (sum, s) { return sum + s; }, 0);
                            // Check if this day respects max interval with neighbors
                            var gapToSecond = Math.floor((new Date(day).getTime() - new Date(secondSessionDate_1).getTime()) / (24 * 60 * 60 * 1000)) - 1;
                            var gapToViolating = Math.floor((new Date(examDates[i]).getTime() - new Date(day).getTime()) / (24 * 60 * 60 * 1000)) - 1;
                            if (gapToSecond <= examMaxGap && gapToViolating <= examMaxGap) {
                                if (intensity < lowestIntensity) {
                                    lowestIntensity = intensity;
                                    bestDay = day;
                                }
                            }
                        }
                        if (bestDay) {
                            console.log("  \u2713 Moving ".concat(exam.subject, " from ").concat(firstSessionDate, " to ").concat(bestDay, " (intensity: ").concat(lowestIntensity, ")"));
                            // Remove from first date
                            var firstDaySchedule = mergedSchedule.get(firstSessionDate);
                            var sessionsOnFirst = firstDaySchedule.get(exam.id) || 0;
                            if (sessionsOnFirst > 1) {
                                firstDaySchedule.set(exam.id, sessionsOnFirst - 1);
                            }
                            else {
                                firstDaySchedule.delete(exam.id);
                            }
                            // Add to best day
                            var bestDaySchedule = mergedSchedule.get(bestDay);
                            bestDaySchedule.set(exam.id, (bestDaySchedule.get(exam.id) || 0) + 1);
                            return "break";
                        }
                    }
                }
            };
            // Check for violations
            for (var i = 1; i < examDates.length; i++) {
                var state_13 = _loop_20(i);
                if (state_13 === "break")
                    break;
            }
        });
    };
    StudyPlannerV1.prototype.validateSchedule = function () {
        var _a;
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var MAX_SESSIONS_PER_DAY = Math.min(3, Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS));
        var mergedSchedule = this.mergeExamsIntoDailyPlan();
        var warnings = [];
        var ruleViolations = [];
        var overloadedDays = [];
        var incompleteExams = [];
        // Check 1: Daily session limit violations
        mergedSchedule.forEach(function (examSessions, date) {
            var totalSessions = Array.from(examSessions.values()).reduce(function (sum, s) { return sum + s; }, 0);
            if (totalSessions > MAX_SESSIONS_PER_DAY) {
                overloadedDays.push({
                    date: date,
                    sessions: totalSessions,
                    limit: MAX_SESSIONS_PER_DAY
                });
                warnings.push("Day ".concat(date, " exceeds daily limit: ").concat(totalSessions, " sessions (max: ").concat(MAX_SESSIONS_PER_DAY, ")"));
            }
        });
        // Check 2: Final review sessions (day before exam)
        for (var _i = 0, _b = this.inputs.exams; _i < _b.length; _i++) {
            var exam = _b[_i];
            var examDate = new Date(exam.exam_date);
            var dayBeforeExam = new Date(examDate.getTime() - 24 * 60 * 60 * 1000);
            var dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
            var daySchedule = mergedSchedule.get(dayBeforeExamStr);
            if (!daySchedule || !daySchedule.has(exam.id) || daySchedule.get(exam.id) === 0) {
                ruleViolations.push("Missing final review session for ".concat(exam.subject, " on ").concat(dayBeforeExamStr));
            }
        }
        var _loop_21 = function (exam) {
            var scheduledDays = [];
            // Collect all days where this exam has sessions
            mergedSchedule.forEach(function (examSessions, date) {
                if (examSessions.has(exam.id) && examSessions.get(exam.id) > 0) {
                    scheduledDays.push(date);
                }
            });
            // Sort the scheduled days
            scheduledDays.sort();
            // Check for gaps larger than 3 days between consecutive sessions
            for (var i = 0; i < scheduledDays.length - 1; i++) {
                var currentDate = new Date(scheduledDays[i]);
                var nextDate = new Date(scheduledDays[i + 1]);
                var daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDiff > 3) {
                    ruleViolations.push("Gap of ".concat(daysDiff, " days between ").concat(exam.subject, " sessions on ").concat(scheduledDays[i], " and ").concat(scheduledDays[i + 1], " (max allowed: 3 days)"));
                }
            }
        };
        // Check 3: Maximum 3-day gap between sessions of same exam
        for (var _c = 0, _d = this.inputs.exams; _c < _d.length; _c++) {
            var exam = _d[_c];
            _loop_21(exam);
        }
        var _loop_22 = function (exam) {
            if (!exam.can_study_after_exam) {
                var examDateStr_4 = exam.exam_date.toISOString().split('T')[0];
                mergedSchedule.forEach(function (examSessions, date) {
                    if (date > examDateStr_4 && examSessions.has(exam.id) && examSessions.get(exam.id) > 0) {
                        ruleViolations.push("Session for ".concat(exam.subject, " scheduled after exam date on ").concat(date));
                    }
                });
            }
        };
        // Check 4: Sessions after exam date (unless allowed)
        for (var _e = 0, _f = this.inputs.exams; _e < _f.length; _e++) {
            var exam = _f[_e];
            _loop_22(exam);
        }
        var _loop_23 = function (exam) {
            var totalHours = Math.max(0, this_8.calculateTotalHours(exam) - (((_a = this_8.inputs.completed_hours) === null || _a === void 0 ? void 0 : _a[exam.id]) || 0));
            var requiredSessions = Math.ceil(totalHours / STUDY_CHUNK_HOURS);
            var scheduledSessions = 0;
            mergedSchedule.forEach(function (examSessions) {
                scheduledSessions += examSessions.get(exam.id) || 0;
            });
            if (scheduledSessions < requiredSessions) {
                var missingSessions = requiredSessions - scheduledSessions;
                incompleteExams.push({
                    examName: exam.subject,
                    missingSessions: missingSessions
                });
                warnings.push("".concat(exam.subject, " is missing ").concat(missingSessions, " sessions (required: ").concat(requiredSessions, ", scheduled: ").concat(scheduledSessions, ")"));
            }
        };
        var this_8 = this;
        // Check 5: Incomplete exams (not enough sessions)
        for (var _g = 0, _h = this.inputs.exams; _g < _h.length; _g++) {
            var exam = _h[_g];
            _loop_23(exam);
        }
        var isValid = ruleViolations.length === 0 && overloadedDays.length === 0 && incompleteExams.length === 0;
        return {
            isValid: isValid,
            warnings: warnings,
            ruleViolations: ruleViolations,
            overloadedDays: overloadedDays,
            incompleteExams: incompleteExams
        };
    };
    StudyPlannerV1.prototype.getFinalScheduleWithValidation = function () {
        var _this = this;
        var mergedSchedule = this.mergeExamsIntoDailyPlan();
        var validation = this.validateSchedule();
        // Convert to calendar format
        var calendar = {};
        mergedSchedule.forEach(function (examSessions, date) {
            var daySchedule = [];
            examSessions.forEach(function (sessions, examId) {
                var exam = _this.inputs.exams.find(function (e) { return e.id === examId; });
                if (exam) {
                    daySchedule.push({
                        examName: exam.subject,
                        sessions: sessions
                    });
                }
            });
            calendar[date] = daySchedule;
        });
        // Explanation for 3+ exam handling
        var explanation = "\n3+ Exam Handling Explanation:\n\u2022 Conflict Resolution: When multiple exams compete for the same day, priority is given to exams with earlier dates, higher difficulty, and earlier assignment order\n\u2022 Low-Pressure Placement: Sessions for exams furthest away are moved to earlier low-intensity days to balance the schedule\n\u2022 Balancing: The algorithm redistributes sessions from overloaded days to underloaded days, ensuring even distribution across the entire study period\n\u2022 Final Review: Each exam gets a guaranteed session the day before the exam\n\u2022 3-Day Gap Rule: No more than 3 days can pass between sessions of the same exam (max gap = 3 days)\n\u2022 Daily Limits: Respects maximum sessions per day, moving excess sessions to earlier days when needed\n    ".trim();
        return {
            calendar: calendar,
            validation: validation,
            explanation: explanation
        };
    };
    StudyPlannerV1.prototype.calculateTotalHours = function (exam) {
        // User's estimate is the baseline, with max 10% adjustment based on difficulty/confidence
        var maxAdjustmentPercent = 0.10; // Fixed at 10% max
        var difficultyMultiplier = 1 + (exam.difficulty - 3) * (maxAdjustmentPercent / 2); // Half from difficulty
        var confidenceMultiplier = 1 - (exam.confidence - 3) * (maxAdjustmentPercent / 2); // Half from confidence
        var adjustmentFactor = (difficultyMultiplier + confidenceMultiplier) / 2;
        // Calculate adjusted hours and cap at 10% increase/decrease
        var calculatedHours = exam.user_estimated_total_hours * adjustmentFactor;
        var minAllowedHours = exam.user_estimated_total_hours * 0.90; // Max 10% decrease
        var maxAllowedHours = exam.user_estimated_total_hours * 1.10; // Max 10% increase
        var finalHours = Math.max(1, Math.min(Math.round(calculatedHours * 10) / 10, maxAllowedHours)); // Round to 1 decimal
        return finalHours;
    };
    StudyPlannerV1.prototype.initializeInternalState = function (exams) {
        var _this = this;
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        return exams.filter(function (exam) { return exam != null; }).map(function (exam) {
            var _a;
            var totalHours = _this.calculateTotalHours(exam);
            var existingHours = (_this.inputs.existing_sessions || [])
                .filter(function (s) { return s.subjectId === exam.id; })
                .reduce(function (sum, s) { return sum + s.duration; }, 0);
            var completedHours = ((_a = _this.inputs.completed_hours) === null || _a === void 0 ? void 0 : _a[exam.id]) || 0;
            return {
                id: exam.id,
                subject: exam.subject,
                exam_date: new Date(exam.exam_date),
                remaining_hours: totalHours - existingHours - completedHours,
                state: 'ACTIVE',
                days_to_exam: 0,
                last_study_day: null,
                original_difficulty: exam.difficulty,
                original_confidence: exam.confidence,
            };
        });
    };
    StudyPlannerV1.prototype.generateSingleExamPlan = function () {
        var _a, _b;
        var _c;
        var exam = this.subjects[0];
        // For single exam, use the full calculated hours (no need for final review reservation)
        var examInput = this.inputs.exams.find(function (e) { return e.id === exam.id; });
        var totalCalculatedHours = this.calculateTotalHours(examInput);
        var completedHours = ((_c = this.inputs.completed_hours) === null || _c === void 0 ? void 0 : _c[exam.id]) || 0;
        var totalRequiredHours = Math.max(0, totalCalculatedHours - completedHours);
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var totalChunksNeeded = Math.ceil(totalRequiredHours / STUDY_CHUNK_HOURS);
        var maxSessionsPerDay = Math.floor(this.inputs.daily_max_hours / STUDY_CHUNK_HOURS);
        console.log("Single exam plan: ".concat(exam.subject, ", totalCalculated: ").concat(totalCalculatedHours, ", completedHours: ").concat(completedHours, ", totalRequired: ").concat(totalRequiredHours, ", chunks: ").concat(totalChunksNeeded));
        // Use generateValidSlotsForExam to get available days excluding blocked days
        var validSlots = this.generateValidSlotsForExam(examInput);
        var availableDays = validSlots.length;
        console.log("Available days (excluding blocked): ".concat(availableDays, ", Sessions needed: ").concat(totalChunksNeeded, ", Max per day: ").concat(maxSessionsPerDay));
        console.log("Valid slots:", validSlots.map(function (d) { return d.toISOString().split('T')[0]; }));
        // If we don't have enough days for 1 session per day, we need multiple sessions per day
        if (availableDays < totalChunksNeeded) {
            console.log("\u26A0\uFE0F Not enough days! Will place multiple sessions per day.");
            var remainingChunks = totalChunksNeeded;
            for (var i = 0; i < validSlots.length && remainingChunks > 0; i++) {
                var slotDate = validSlots[i];
                var daysLeft = validSlots.length - i;
                var chunksForThisDay = Math.ceil(remainingChunks / daysLeft);
                var hoursForThisDay = chunksForThisDay * STUDY_CHUNK_HOURS;
                var daySchedule = {
                    date: new Date(slotDate),
                    total_hours: hoursForThisDay,
                    subjects: (_a = {}, _a[exam.id] = hoursForThisDay, _a),
                };
                this.schedule.push(daySchedule);
                console.log("Day ".concat(slotDate.toISOString().split('T')[0], ": ").concat(chunksForThisDay, " sessions (").concat(hoursForThisDay, " hours), remaining: ").concat(remainingChunks - chunksForThisDay));
                remainingChunks -= chunksForThisDay;
            }
        }
        else {
            // Normal case: enough days for 1 session per day
            console.log("Enough days available. Placing 1 session per day working backwards from exam.");
            // Work backwards from the last valid slot to ensure no gaps near exam
            var remainingChunks = totalChunksNeeded;
            // Use the last N valid slots where N = totalChunksNeeded
            for (var i = validSlots.length - 1; i >= 0 && remainingChunks > 0; i--) {
                var slotDate = validSlots[i];
                var daySchedule = {
                    date: new Date(slotDate),
                    total_hours: STUDY_CHUNK_HOURS,
                    subjects: (_b = {}, _b[exam.id] = STUDY_CHUNK_HOURS, _b),
                };
                this.schedule.push(daySchedule);
                remainingChunks--;
            }
            // Sort schedule chronologically
            this.schedule.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
        }
        console.log("Created ".concat(this.schedule.length, " days with total sessions: ").concat(totalChunksNeeded));
        return this.schedule;
    };
    StudyPlannerV1.prototype.generatePlan = function () {
        console.log('=== SCHEDULER generatePlan CALLED ===');
        // Only compute and override the optimal start date when daily preferences are ON.
        // When OFF, use today as start and let sessions spread across all available days.
        if (this.inputs.enable_daily_limits !== false) {
            var optimalStart = this.calculateOptimalStartDate();
            if (!this.inputs.start_date || optimalStart > this.inputs.start_date) {
                console.log("Overriding start date: input was ".concat(this.inputs.start_date, ", optimal is ").concat(optimalStart));
                this.inputs.start_date = optimalStart;
            }
        }
        else {
            console.log('Daily preferences OFF: using today as start date, no optimal start override');
        }
        this.subjects = this.initializeInternalState(this.inputs.exams);
        // If there are existing sessions, decide whether to rebalance or regenerate
        if (this.inputs.existing_sessions && this.inputs.existing_sessions.length > 0) {
            var subjectsNeedingSessions = this.subjects.filter(function (s) { return s.remaining_hours > 0; });
            // If new sessions need to be added (e.g., new exam), regenerate the whole schedule
            // to ensure all rules are met correctly from scratch.
            if (subjectsNeedingSessions.length > 0) {
                return this.generateNewSchedule();
            }
            // Otherwise, just rebalance the existing schedule (e.g., to fill gaps without adding new hours)
            return this.rebalanceExistingSchedule();
        }
        // If no existing sessions, generate a fresh schedule
        return this.generateNewSchedule();
    };
    StudyPlannerV1.prototype.generateNewSchedule = function () {
        var _this = this;
        this.schedule = []; // Start with a clean slate
        this.subjects = this.initializeInternalState(this.inputs.exams); // Re-initialize to reset remaining_hours
        if (this.subjects.length === 0) {
            return { schedule: [] };
        }
        // All exams (including single) go through the unified scoring engine
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var mergedSchedule = this.mergeExamsIntoDailyPlan();
        // Balance and enforce rules on the merged schedule
        this.addEmptyDaysToSchedule(mergedSchedule);
        this.balanceWorkload(mergedSchedule);
        this.enforceMaxOneDifference(mergedSchedule);
        // Convert merged schedule to DailySchedule format
        mergedSchedule.forEach(function (examSessions, dateStr) {
            var daySchedule = {
                date: new Date(dateStr),
                total_hours: 0,
                subjects: {}
            };
            examSessions.forEach(function (sessionCount, examId) {
                var hours = sessionCount * STUDY_CHUNK_HOURS;
                daySchedule.subjects[examId] = hours;
                daySchedule.total_hours += hours;
            });
            _this.schedule.push(daySchedule);
        });
        // Sort by date
        this.schedule.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
        return { schedule: this.schedule };
    };
    StudyPlannerV1.prototype.rebalanceExistingSchedule = function () {
        // Create a map of existing sessions by date
        var existingScheduleMap = new Map();
        this.inputs.existing_sessions.forEach(function (session) {
            var dateStr = session.date.toISOString().split('T')[0];
            if (!existingScheduleMap.has(dateStr)) {
                existingScheduleMap.set(dateStr, {
                    date: new Date(session.date),
                    total_hours: 0,
                    subjects: {}
                });
            }
            var daySchedule = existingScheduleMap.get(dateStr);
            daySchedule.subjects[session.subjectId] = (daySchedule.subjects[session.subjectId] || 0) + session.duration;
            daySchedule.total_hours += session.duration;
        });
        this.schedule = Array.from(existingScheduleMap.values()).sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
        // Rebalancing only fills gaps and enforces spacing, it does not add new sessions.
        this.redistributeSessionsForBalance();
        this.enforceSessionSpacing();
        this.schedule.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
        this.ensureFinalReviewSessions();
        return { schedule: this.schedule };
    };
    StudyPlannerV1.prototype.enforceSessionSpacing = function () {
        var _this = this;
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var MAX_DAYS_BETWEEN_SESSIONS = 3;
        var violationsFound = true;
        while (violationsFound) {
            violationsFound = false;
            this.inputs.exams.forEach(function (exam) {
                var examSessions = [];
                _this.schedule.forEach(function (day) {
                    if (day.subjects[exam.id]) {
                        examSessions.push({
                            date: day.date,
                            dateStr: day.date.toISOString().split('T')[0]
                        });
                    }
                });
                examSessions.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
                var _loop_24 = function (i) {
                    var currentSession = examSessions[i];
                    var nextSession = examSessions[i + 1];
                    var daysBetween = Math.floor((nextSession.date.getTime() - currentSession.date.getTime()) / (1000 * 3600 * 24));
                    if (daysBetween > MAX_DAYS_BETWEEN_SESSIONS) {
                        violationsFound = true;
                        var daysInRange = [];
                        var _loop_25 = function (d) {
                            var dateStr = d.toISOString().split('T')[0];
                            var daySchedule = _this.schedule.find(function (ds) { return ds.date.toISOString().split('T')[0] === dateStr; });
                            var intensity = (daySchedule === null || daySchedule === void 0 ? void 0 : daySchedule.total_hours) || 0;
                            var daysToNext = Math.floor((nextSession.date.getTime() - d.getTime()) / (1000 * 3600 * 24));
                            if (daysToNext <= MAX_DAYS_BETWEEN_SESSIONS && daysToNext > 0) {
                                daysInRange.push({ date: new Date(d), dateStr: dateStr, intensity: intensity });
                            }
                        };
                        for (var d = new Date(currentSession.date); d < nextSession.date; d.setDate(d.getDate() + 1)) {
                            _loop_25(d);
                        }
                        daysInRange.sort(function (a, b) { return a.intensity - b.intensity; });
                        var targetDay_1 = daysInRange.find(function (d) { return d.intensity + STUDY_CHUNK_HOURS <= _this.inputs.daily_max_hours; });
                        if (targetDay_1) {
                            var sourceDay = _this.schedule.find(function (d) { return d.date.toISOString().split('T')[0] === currentSession.dateStr; });
                            if (sourceDay) {
                                sourceDay.subjects[exam.id] -= STUDY_CHUNK_HOURS;
                                sourceDay.total_hours -= STUDY_CHUNK_HOURS;
                                if (sourceDay.subjects[exam.id] <= 0)
                                    delete sourceDay.subjects[exam.id];
                                if (sourceDay.total_hours === 0) {
                                    var index = _this.schedule.findIndex(function (d) { return d.date.toISOString().split('T')[0] === currentSession.dateStr; });
                                    if (index > -1)
                                        _this.schedule.splice(index, 1);
                                }
                            }
                            var newDay = _this.schedule.find(function (d) { return d.date.toISOString().split('T')[0] === targetDay_1.dateStr; });
                            if (!newDay) {
                                newDay = { date: new Date(targetDay_1.date), total_hours: 0, subjects: {} };
                                _this.schedule.push(newDay);
                            }
                            newDay.subjects[exam.id] = (newDay.subjects[exam.id] || 0) + STUDY_CHUNK_HOURS;
                            newDay.total_hours += STUDY_CHUNK_HOURS;
                            return { value: void 0 };
                        }
                    }
                };
                for (var i = 0; i < examSessions.length - 1; i++) {
                    var state_14 = _loop_24(i);
                    if (typeof state_14 === "object")
                        return state_14.value;
                }
            });
        }
    };
    StudyPlannerV1.prototype.redistributeSessionsForBalance = function () {
        var _this = this;
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var MAX_ITERATIONS = 50;
        // Build complete date range from first scheduled day to last exam
        var firstDate = this.schedule.length > 0
            ? new Date(Math.min.apply(Math, this.schedule.map(function (d) { return d.date.getTime(); })))
            : new Date(this.inputs.start_date);
        var lastExamDate = new Date(Math.max.apply(Math, this.inputs.exams.map(function (e) { return e.exam_date.getTime(); })));
        // Create a map of all days in the range with their session counts
        var getAllDayLoads = function () {
            var dayLoads = new Map();
            var _loop_26 = function (d) {
                var dateStr = d.toISOString().split('T')[0];
                var existingDay = _this.schedule.find(function (s) { return s.date.toISOString().split('T')[0] === dateStr; });
                dayLoads.set(dateStr, {
                    date: new Date(d),
                    sessions: existingDay ? existingDay.total_hours / STUDY_CHUNK_HOURS : 0,
                    schedule: existingDay || null
                });
            };
            for (var d = new Date(firstDate); d < lastExamDate; d.setDate(d.getDate() + 1)) {
                _loop_26(d);
            }
            return dayLoads;
        };
        for (var iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            var dayLoads = getAllDayLoads();
            var days = Array.from(dayLoads.values());
            // Find the day with max sessions and day with min sessions
            var maxDay = days.reduce(function (max, d) { return d.sessions > max.sessions ? d : max; }, days[0]);
            var minDay = days.reduce(function (min, d) { return d.sessions < min.sessions ? d : min; }, days[0]);
            // If difference is 1 or less, schedule is balanced
            if (maxDay.sessions - minDay.sessions <= 1) {
                break;
            }
            // Find a subject we can move from maxDay to minDay
            // Must be: not a review day, and minDay must be before the exam
            if (!maxDay.schedule)
                continue;
            var moved = false;
            // Sort subjects by exam date (furthest first - most flexible to move)
            var subjectsOnMaxDay = Object.keys(maxDay.schedule.subjects)
                .map(function (id) { return ({ id: id, exam: _this.inputs.exams.find(function (e) { return e.id === id; }) }); })
                .filter(function (s) { return s.exam; })
                .sort(function (a, b) { return b.exam.exam_date.getTime() - a.exam.exam_date.getTime(); });
            for (var _i = 0, subjectsOnMaxDay_1 = subjectsOnMaxDay; _i < subjectsOnMaxDay_1.length; _i++) {
                var _a = subjectsOnMaxDay_1[_i], subjectId = _a.id, exam = _a.exam;
                if (!exam)
                    continue;
                // Check if maxDay is the review day for this subject
                var reviewDate = new Date(exam.exam_date.getTime() - 24 * 60 * 60 * 1000);
                var isReviewDay = reviewDate.toISOString().split('T')[0] === maxDay.date.toISOString().split('T')[0];
                if (isReviewDay)
                    continue;
                // Check if minDay is before this exam (can't study after exam)
                if (minDay.date >= exam.exam_date)
                    continue;
                // Move one session from maxDay to minDay
                maxDay.schedule.subjects[subjectId] -= STUDY_CHUNK_HOURS;
                maxDay.schedule.total_hours -= STUDY_CHUNK_HOURS;
                if (maxDay.schedule.subjects[subjectId] <= 0) {
                    delete maxDay.schedule.subjects[subjectId];
                }
                // Add to minDay (create if doesn't exist)
                var targetDay = minDay.schedule;
                if (!targetDay) {
                    targetDay = { date: new Date(minDay.date), total_hours: 0, subjects: {} };
                    this.schedule.push(targetDay);
                }
                targetDay.subjects[subjectId] = (targetDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
                targetDay.total_hours += STUDY_CHUNK_HOURS;
                moved = true;
                break;
            }
            if (!moved)
                break; // No valid moves found
        }
        this.schedule.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
    };
    StudyPlannerV1.prototype.ensureFinalReviewSessions = function () {
        var STUDY_CHUNK_HOURS = this.inputs.session_duration / 60;
        var _loop_27 = function (exam) {
            var subjectId = exam.id;
            var examDate = new Date(exam.exam_date);
            var reviewDate = new Date(examDate.getTime() - (24 * 60 * 60 * 1000));
            var reviewDateStr = reviewDate.toISOString().split('T')[0];
            // 1. Check if a review session already exists
            var reviewDaySchedule = this_9.schedule.find(function (d) { return d.date.toISOString().split('T')[0] === reviewDateStr; });
            if (reviewDaySchedule && reviewDaySchedule.subjects[subjectId] > 0) {
                return "continue";
            }
            // 2. Find the busiest day for this subject to steal a chunk from
            var donorDay = null;
            var maxHours = 0;
            for (var _b = 0, _c = this_9.schedule; _b < _c.length; _b++) {
                var day = _c[_b];
                var hours = day.subjects[subjectId] || 0;
                if (hours > maxHours) {
                    maxHours = hours;
                    donorDay = day;
                }
            }
            if (!donorDay) {
                return "continue";
            }
            // 3. Steal a chunk from the donor day
            donorDay.subjects[subjectId] -= STUDY_CHUNK_HOURS;
            donorDay.total_hours -= STUDY_CHUNK_HOURS;
            if (donorDay.subjects[subjectId] <= 0) {
                delete donorDay.subjects[subjectId];
            }
            // 4. Give the chunk to the review day
            var recipientDay = this_9.schedule.find(function (d) { return d.date.toISOString().split('T')[0] === reviewDateStr; });
            if (!recipientDay) {
                // If the review day doesn't exist in the schedule, create it.
                recipientDay = { date: reviewDate, total_hours: 0, subjects: {} };
                this_9.schedule.push(recipientDay);
            }
            // Only add if there's capacity
            if (recipientDay.total_hours + STUDY_CHUNK_HOURS <= this_9.inputs.daily_max_hours) {
                recipientDay.subjects[subjectId] = (recipientDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
                recipientDay.total_hours += STUDY_CHUNK_HOURS;
            }
            else {
                // If no capacity, return the chunk to the donor
                donorDay.subjects[subjectId] = (donorDay.subjects[subjectId] || 0) + STUDY_CHUNK_HOURS;
                donorDay.total_hours += STUDY_CHUNK_HOURS;
            }
        };
        var this_9 = this;
        for (var _i = 0, _a = this.inputs.exams; _i < _a.length; _i++) {
            var exam = _a[_i];
            _loop_27(exam);
        }
        // Sort the schedule by date again as we might have added new days
        this.schedule.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });
    };
    StudyPlannerV1.prototype.checkEarlyCompletion = function (subject, hoursToAssign) {
        var EARLY_COMPLETION_DAYS = 2;
        // If we're already within the critical window (≤3 days), allow completion
        // This prevents gaps right before exams (rule §3.2)
        if (subject.days_to_exam <= 3) {
            return true;
        }
        // Otherwise, enforce the early completion rule
        if (subject.remaining_hours - hoursToAssign <= 0 && subject.days_to_exam > EARLY_COMPLETION_DAYS) {
            return false;
        }
        return true;
    };
    StudyPlannerV1.prototype.checkSubjectDominance = function (subjectId, hoursToAssign, day) {
        // §3.4: This rule should only apply when multiple subjects are being juggled.
        var activeSubjectsCount = this.subjects.filter(function (s) { return s.state === 'ACTIVE'; }).length;
        if (activeSubjectsCount <= 1) {
            return true; // Ignore this rule if there's only one subject to focus on.
        }
        // This rule should not prevent the very first chunk of the day.
        if (day.total_hours === 0) {
            return true; // OK
        }
        var proposedSubjectHours = (day.subjects[subjectId] || 0) + hoursToAssign;
        var proposedTotalHours = day.total_hours + hoursToAssign;
        if (proposedSubjectHours / proposedTotalHours > 0.5) {
            return false; // Violation
        }
        return true; // OK
    };
    StudyPlannerV1.prototype.calculatePriorityScore = function (subject) {
        // Simplified priority: Focus on subjects with more work left and that haven't been studied recently.
        var totalInitialHours = this.calculateTotalHours(this.inputs.exams.find(function (e) { return e.id === subject.id; }));
        var progress = totalInitialHours > 0 ? subject.remaining_hours / totalInitialHours : 0; // Higher is more urgent
        var daysSinceLast = subject.last_study_day ? (new Date().getTime() - subject.last_study_day.getTime()) / (1000 * 3600 * 24) : 0;
        // Weights are tuned to favor progress (subjects with more hours left) and recency.
        var priority = (progress * 0.8) + (daysSinceLast * 0.2);
        // This massive bonus ensures the final review session is prioritized above all else.
        if (subject.days_to_exam === 1) {
            priority += 1000;
        }
        return isNaN(priority) ? 0 : priority;
    };
    return StudyPlannerV1;
}());
exports.StudyPlannerV1 = StudyPlannerV1;
