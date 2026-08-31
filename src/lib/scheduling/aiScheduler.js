"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAISchedule = generateAISchedule;
/**
 * Generate a study schedule using EXACT material definitions.
 * Returns Map<date, Map<examId, Array<SessionBlock>>>
 */
function generateAISchedule(inputs) {
    return __awaiter(this, void 0, void 0, function () {
        var blockedSet, lastExamDate, availableDates, d, dateStr, examTopics, _loop_1, _a, _b, exam, MAX_MINUTES_PER_DAY, PREFERRED_MINUTES_PER_DAY, finalSchedule, wasOverloadedGlobally, simulate, dailyLoadMinutes, examTargetDates, anyExamOverloaded, exams, _loop_2, exams_1, exams_1_1, exam, _loop_3, exams_2, exams_2_1, exam, exams_3, exams_3_1, exam, topics, targetDates, i, dateStr, dayMap;
        var e_1, _c, e_2, _d, e_3, _e, e_4, _f;
        return __generator(this, function (_g) {
            blockedSet = new Set(inputs.blocked_days || []);
            lastExamDate = new Date(Math.max.apply(Math, __spreadArray([], __read(inputs.exams.map(function (e) { return e.exam_date.getTime(); })), false)));
            availableDates = [];
            for (d = new Date(inputs.start_date); d <= lastExamDate; d.setDate(d.getDate() + 1)) {
                dateStr = d.toISOString().split('T')[0];
                if (!blockedSet.has(dateStr)) {
                    availableDates.push(dateStr);
                }
            }
            examTopics = new Map();
            _loop_1 = function (exam) {
                var e_5, _h, e_6, _j;
                if (exam.studyMaterials.length === 0)
                    return "continue";
                var blocks = [];
                // Check if we can bypass by using existing sessions
                if (inputs.existing_sessions) {
                    var existingForExam = inputs.existing_sessions.filter(function (s) { return s.examId === exam.id; });
                    if (existingForExam.length > 0) {
                        try {
                            for (var existingForExam_1 = (e_5 = void 0, __values(existingForExam)), existingForExam_1_1 = existingForExam_1.next(); !existingForExam_1_1.done; existingForExam_1_1 = existingForExam_1.next()) {
                                var s = existingForExam_1_1.value;
                                blocks.push({
                                    content: s.content,
                                    durationMinutes: inputs.session_duration
                                });
                            }
                        }
                        catch (e_5_1) { e_5 = { error: e_5_1 }; }
                        finally {
                            try {
                                if (existingForExam_1_1 && !existingForExam_1_1.done && (_h = existingForExam_1.return)) _h.call(existingForExam_1);
                            }
                            finally { if (e_5) throw e_5.error; }
                        }
                    }
                }
                if (blocks.length === 0) {
                    try {
                        for (var _k = (e_6 = void 0, __values(exam.studyMaterials)), _l = _k.next(); !_l.done; _l = _k.next()) {
                            var c = _l.value;
                            var duration = Math.round((c.user_estimated_total_hours || 0) * 60);
                            if (duration <= 0)
                                duration = inputs.session_duration;
                            var limit = inputs.session_duration * 1.5;
                            if (duration > limit) {
                                // We separate it evenly into sessions
                                var numSessions = Math.ceil(duration / inputs.session_duration);
                                var splitDuration = Math.round(duration / numSessions);
                                for (var i = 0; i < numSessions; i++) {
                                    // Ensure the total sum adds up perfectly despite rounding, assign remaining to last chunk
                                    var actualDuration = i === numSessions - 1 ? duration - (splitDuration * (numSessions - 1)) : splitDuration;
                                    blocks.push({
                                        content: c.chapter,
                                        durationMinutes: actualDuration
                                    });
                                }
                            }
                            else {
                                blocks.push({
                                    content: c.chapter,
                                    durationMinutes: duration
                                });
                            }
                        }
                    }
                    catch (e_6_1) { e_6 = { error: e_6_1 }; }
                    finally {
                        try {
                            if (_l && !_l.done && (_j = _k.return)) _j.call(_k);
                        }
                        finally { if (e_6) throw e_6.error; }
                    }
                }
                examTopics.set(exam.id, blocks);
            };
            try {
                for (_a = __values(inputs.exams), _b = _a.next(); !_b.done; _b = _a.next()) {
                    exam = _b.value;
                    _loop_1(exam);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                }
                finally { if (e_1) throw e_1.error; }
            }
            MAX_MINUTES_PER_DAY = inputs.daily_max_hours * 60;
            PREFERRED_MINUTES_PER_DAY = inputs.soft_daily_limit * 60;
            finalSchedule = new Map();
            wasOverloadedGlobally = false;
            simulate = true;
            while (simulate) {
                finalSchedule = new Map();
                dailyLoadMinutes = new Map();
                examTargetDates = new Map();
                anyExamOverloaded = false;
                exams = __spreadArray([], __read(inputs.exams), false).sort(function (a, b) { return new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime(); });
                _loop_2 = function (exam) {
                    var topics = examTopics.get(exam.id) || [];
                    var lastValidDay = exam.can_study_after_exam
                        ? exam.exam_date.toISOString().split('T')[0]
                        : new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];
                    var validDatesForExam = availableDates.filter(function (d) { return !blockedSet.has(d) && d <= lastValidDay; });
                    if (validDatesForExam.length === 0 || topics.length === 0)
                        return "continue";
                    var targetDates = [];
                    var unassignedCount = topics.length;
                    var topicIndex = topics.length - 1; // Work backwards
                    while (topicIndex >= 0) {
                        var topic = topics[topicIndex];
                        var selectedDay = null;
                        // Pass 1: Backwards Bin-Packing up to Preferred Limit
                        for (var i = validDatesForExam.length - 1; i >= 0; i--) {
                            var d = validDatesForExam[i];
                            var load = dailyLoadMinutes.get(d) || 0;
                            if (load + topic.durationMinutes <= PREFERRED_MINUTES_PER_DAY) {
                                selectedDay = d;
                                break;
                            }
                        }
                        // Pass 2: Waterfill - find the valid date (iterating backwards) with the MINIMUM load that is under MAX_MINUTES_PER_DAY
                        if (!selectedDay) {
                            var minLoad = Infinity;
                            var bestDay = null;
                            for (var i = validDatesForExam.length - 1; i >= 0; i--) {
                                var d = validDatesForExam[i];
                                var load = dailyLoadMinutes.get(d) || 0;
                                if (load < minLoad && load + topic.durationMinutes <= MAX_MINUTES_PER_DAY) {
                                    minLoad = load;
                                    bestDay = d;
                                }
                            }
                            if (bestDay) {
                                selectedDay = bestDay;
                            }
                        }
                        if (selectedDay) {
                            targetDates.unshift(selectedDay);
                            dailyLoadMinutes.set(selectedDay, (dailyLoadMinutes.get(selectedDay) || 0) + topic.durationMinutes);
                            unassignedCount--;
                        }
                        else {
                            break; // Stop assigning, we hit a wall for this exam
                        }
                        topicIndex--;
                    }
                    examTargetDates.set(exam.id, targetDates);
                    if (unassignedCount > 0) {
                        anyExamOverloaded = true;
                    }
                };
                try {
                    for (exams_1 = (e_2 = void 0, __values(exams)), exams_1_1 = exams_1.next(); !exams_1_1.done; exams_1_1 = exams_1.next()) {
                        exam = exams_1_1.value;
                        _loop_2(exam);
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (exams_1_1 && !exams_1_1.done && (_d = exams_1.return)) _d.call(exams_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                if (anyExamOverloaded) {
                    if (inputs.allowOverload) {
                        _loop_3 = function (exam) {
                            var targetDates = examTargetDates.get(exam.id) || [];
                            var topics = examTopics.get(exam.id) || [];
                            var unassignedCount = topics.length - targetDates.length;
                            if (unassignedCount > 0) {
                                var lastValidDay_1 = exam.can_study_after_exam ? exam.exam_date.toISOString().split('T')[0] : new Date(new Date(exam.exam_date).getTime() - 86400000).toISOString().split('T')[0];
                                var validDatesForExam = availableDates.filter(function (d) { return !blockedSet.has(d) && d <= lastValidDay_1; });
                                if (validDatesForExam.length > 0) {
                                    var dayIdx = validDatesForExam.length - 1;
                                    while (unassignedCount > 0) {
                                        var d = validDatesForExam[dayIdx];
                                        targetDates.unshift(d);
                                        var topic = topics[unassignedCount - 1]; // The unassigned topic
                                        dailyLoadMinutes.set(d, (dailyLoadMinutes.get(d) || 0) + topic.durationMinutes);
                                        unassignedCount--;
                                        dayIdx--;
                                        if (dayIdx < 0)
                                            dayIdx = validDatesForExam.length - 1;
                                    }
                                }
                            }
                            examTargetDates.set(exam.id, targetDates);
                        };
                        try {
                            for (exams_2 = (e_3 = void 0, __values(exams)), exams_2_1 = exams_2.next(); !exams_2_1.done; exams_2_1 = exams_2.next()) {
                                exam = exams_2_1.value;
                                _loop_3(exam);
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (exams_2_1 && !exams_2_1.done && (_e = exams_2.return)) _e.call(exams_2);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                        simulate = false;
                    }
                    else {
                        wasOverloadedGlobally = true;
                        break; // Exit the while loop immediately without mutating topics
                    }
                }
                else {
                    simulate = false;
                }
                if (!simulate && (!anyExamOverloaded || (anyExamOverloaded && inputs.allowOverload))) {
                    try {
                        for (exams_3 = (e_4 = void 0, __values(exams)), exams_3_1 = exams_3.next(); !exams_3_1.done; exams_3_1 = exams_3.next()) {
                            exam = exams_3_1.value;
                            topics = examTopics.get(exam.id) || [];
                            targetDates = examTargetDates.get(exam.id) || [];
                            targetDates.sort(function (a, b) { return new Date(a).getTime() - new Date(b).getTime(); });
                            for (i = 0; i < targetDates.length; i++) {
                                dateStr = targetDates[i];
                                if (!finalSchedule.has(dateStr))
                                    finalSchedule.set(dateStr, new Map());
                                dayMap = finalSchedule.get(dateStr);
                                if (!dayMap.has(exam.id))
                                    dayMap.set(exam.id, []);
                                if (i < topics.length) {
                                    dayMap.get(exam.id).push(topics[i]);
                                }
                            }
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (exams_3_1 && !exams_3_1.done && (_f = exams_3.return)) _f.call(exams_3);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                }
            }
            return [2 /*return*/, { schedule: finalSchedule, wasOverloaded: wasOverloadedGlobally }];
        });
    });
}
