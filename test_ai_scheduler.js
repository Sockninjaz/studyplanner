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
Object.defineProperty(exports, "__esModule", { value: true });
var aiScheduler_1 = require("./src/lib/scheduling/aiScheduler");
function runTest() {
    return __awaiter(this, void 0, void 0, function () {
        var now, examDate, inputs, result, _a, _b, _c, date, examMap, _d, _e, _f, examId, sessions;
        var e_1, _g, e_2, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    now = new Date();
                    examDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
                    inputs = {
                        daily_max_hours: 4,
                        soft_daily_limit: 1,
                        session_duration: 60,
                        start_date: now,
                        allowOverload: true,
                        exams: [
                            {
                                id: 'exam1',
                                subject: 'Math',
                                exam_date: examDate,
                                totalHours: 8,
                                can_study_after_exam: false,
                                studyMaterials: [
                                    { chapter: 'Chapter 1', difficulty: 3, user_estimated_total_hours: 8 }
                                ]
                            }
                        ]
                    };
                    return [4 /*yield*/, (0, aiScheduler_1.generateAISchedule)(inputs)];
                case 1:
                    result = _j.sent();
                    console.log("=== AI SCHEDULER RESULT ===");
                    try {
                        for (_a = __values(result.schedule.entries()), _b = _a.next(); !_b.done; _b = _a.next()) {
                            _c = __read(_b.value, 2), date = _c[0], examMap = _c[1];
                            try {
                                for (_d = (e_2 = void 0, __values(examMap.entries())), _e = _d.next(); !_e.done; _e = _d.next()) {
                                    _f = __read(_e.value, 2), examId = _f[0], sessions = _f[1];
                                    console.log("Day ".concat(date, ": ").concat(sessions.length, " sessions"));
                                }
                            }
                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                            finally {
                                try {
                                    if (_e && !_e.done && (_h = _d.return)) _h.call(_d);
                                }
                                finally { if (e_2) throw e_2.error; }
                            }
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_g = _a.return)) _g.call(_a);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    return [2 /*return*/];
            }
        });
    });
}
runTest().catch(console.error);
