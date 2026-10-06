import XCTest
@testable import KinetiqWatchCore

final class WorkoutTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_790_000_000)

    private func routine() -> Routine {
        Routine(id: "rtn_1", name: "Push", items: [
            RoutineItem(
                id: "rit_1", exerciseId: "ex:barbell-bench-press", exerciseName: "Bench Press",
                trackingType: .weightReps, sets: Fixtures.sets(3, reps: 8, weightKg: 60), restSeconds: 90,
                notes: "Pause"
            ),
            RoutineItem(
                id: "rit_2", exerciseId: "local:dips", exerciseName: "Dips",
                trackingType: .weightReps, sets: Fixtures.sets(1, reps: 12, weightKg: 0), restSeconds: 0, notes: nil
            )
        ])
    }

    private func workout() -> Workout {
        Workout.start(routine: routine(), unitSystem: .metric, id: "0F2C-UUID", now: start)
    }

    func testStartCopiesTheRoutineLikeEntriesFromItems() {
        let workout = workout()
        XCTAssertEqual(workout.entries.count, 2)
        XCTAssertEqual(workout.entries.first?.sets.count, 3)
        XCTAssertEqual(workout.entries.first?.sets.first?.reps, 8)
        XCTAssertEqual(workout.entries.first?.sets.first?.weightKg, 60)
        XCTAssertEqual(workout.entries.last?.sets.count, 1)
        XCTAssertEqual(workout.entries.last?.sets.first?.reps, 12)
        XCTAssertEqual(workout.plannedSets, 4)
        XCTAssertEqual(workout.completedSets, 0)
    }

    func testStartPlansEachSetFromItsOwnRowWithItsTargetRPE() {
        let pyramid: [RoutineSet] = [
            .weightReps(reps: 10, weightKg: 60),
            .weightReps(reps: 8, weightKg: 65, targetRpe: 8),
            .weightReps(reps: 6, weightKg: 70, targetRpe: 9.5)
        ]
        let routine = Routine(id: "r", name: "Push", items: [Fixtures.weightRepsItem("i", "E", sets: pyramid)])
        let sets = Workout.start(routine: routine, unitSystem: .metric, id: "w", now: start).entries.first?.sets
        XCTAssertEqual(sets?.map(\.index), [0, 1, 2])
        XCTAssertEqual(sets?.map(\.reps), [10, 8, 6])
        XCTAssertEqual(sets?.map(\.weightKg), [60, 65, 70])
        XCTAssertEqual(sets?.map(\.rpe), [nil, 8, 9.5])
    }

    func testCompletingASetStartsItsRest() {
        var workout = workout()
        XCTAssertEqual(workout.completeNextSet(in: 0, now: start), 90)
        XCTAssertEqual(workout.nextSet(in: 0), 1)
        XCTAssertEqual(workout.restRemaining(now: start.addingTimeInterval(30)), 60)
        XCTAssertEqual(workout.restRemaining(now: start.addingTimeInterval(200)), 0)
        XCTAssertEqual(workout.completedSets, 1)
    }

    func testZeroRestStartsNoTimerAndAFinishedExerciseCompletesNothing() {
        var workout = workout()
        XCTAssertEqual(workout.completeNextSet(in: 1, now: start), 0)
        XCTAssertNil(workout.restEndsAt)
        XCTAssertNil(workout.completeNextSet(in: 1, now: start))
        XCTAssertNil(workout.completeNextSet(in: 9, now: start))
    }

    func testUndoReopensTheLastCompletedSetInOrder() {
        var workout = workout()
        workout.completeNextSet(in: 0, now: start)
        workout.completeNextSet(in: 1, now: start)
        workout.undoLastCompleted()
        XCTAssertEqual(workout.nextSet(in: 1), 0)
        XCTAssertEqual(workout.currentEntry, 1)
        XCTAssertNil(workout.restEndsAt)
        workout.undoLastCompleted()
        XCTAssertEqual(workout.nextSet(in: 0), 0)
        XCTAssertFalse(workout.canUndo)
        workout.undoLastCompleted()
        XCTAssertEqual(workout.completedSets, 0)
    }

    func testEditsApplyToTheRemainingSetsAndStayInBounds() {
        var workout = workout()
        workout.completeNextSet(in: 0, now: start)
        workout.setWeight(62.5, in: 0, bounds: Fixtures.bounds)
        workout.setReps(6, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.map(\.weightKg), [60, 62.5, 62.5])
        XCTAssertEqual(workout.entries.first?.sets.map(\.reps), [8, 6, 6])
        workout.setWeight(900, in: 0, bounds: Fixtures.bounds)
        workout.setReps(0, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.last?.weightKg, 450)
        XCTAssertEqual(workout.entries.first?.sets.last?.reps, 1)
        workout.setRest(9999, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.restSeconds, 600)
        workout.setWeight(.nan, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.last?.weightKg, 0)
    }

    func testFinishWritesTheWireDocumentWithExplicitNulls() throws {
        var workout = workout()
        workout.completeNextSet(in: 0, now: start)
        let data = try XCTUnwrap(workout.document(endedAt: start.addingTimeInterval(1800)).json())
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["format"] as? String, "kinetiq.watch-workout")
        XCTAssertEqual(json["version"] as? Int, 3)
        XCTAssertEqual(json["id"] as? String, "0F2C-UUID")
        XCTAssertEqual(json["routineId"] as? String, "rtn_1")
        XCTAssertTrue(json["notes"] is NSNull)
        XCTAssertEqual(json["startedAt"] as? String, "2026-09-21T14:13:20.000Z")
        XCTAssertEqual(json["endedAt"] as? String, "2026-09-21T14:43:20.000Z")
        let entries = try XCTUnwrap(json["entries"] as? [[String: Any]])
        let sets = try XCTUnwrap(entries.first?["sets"] as? [[String: Any]])
        XCTAssertEqual(sets.first?["completed"] as? Bool, true)
        XCTAssertTrue(sets.first?["rpe"] is NSNull)
        XCTAssertTrue(entries.last?["notes"] is NSNull)
    }

    func testTheWireDocumentCarriesExactlyTheSchemaKeys() throws {
        let data = try XCTUnwrap(workout().document(endedAt: start).json())
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(
            Set(json.keys),
            ["format", "version", "id", "routineId", "title", "startedAt", "endedAt", "entries", "notes"]
        )
        let entry = try XCTUnwrap((json["entries"] as? [[String: Any]])?.first)
        XCTAssertEqual(Set(entry.keys), ["exerciseId", "exerciseName", "trackingType", "restSeconds", "notes", "sets"])
        XCTAssertEqual(entry["trackingType"] as? String, "weightReps")
        let set = try XCTUnwrap((entry["sets"] as? [[String: Any]])?.first)
        XCTAssertEqual(Set(set.keys), ["type", "index", "reps", "weightKg", "completed", "rpe"])
        XCTAssertEqual(set["type"] as? String, "weightReps")
    }

    func testResumesFromDiskExactly() {
        let files = Fixtures.temporaryStore()
        let store = WorkoutStore(files: files)
        XCTAssertEqual(store.load(), .none)
        var workout = workout()
        workout.completeNextSet(in: 0, now: start)
        workout.setCurrentEntry(1)
        XCTAssertTrue(store.save(workout))
        XCTAssertEqual(WorkoutStore(files: files).load(), .workout(workout))
        store.remove()
        XCTAssertEqual(store.load(), .none)
    }

    func testACorruptOrOlderWorkoutFileIsMovedAsideNotCrashedOn() {
        let files = Fixtures.temporaryStore()
        files.writeData(Data("{\"version\": 1, \"id\": ".utf8), to: "workout.json")
        let store = WorkoutStore(files: files)
        XCTAssertEqual(store.load(), .discarded)
        XCTAssertEqual(store.load(), .none)
        XCTAssertEqual(files.list("unreadable").count, 1)
    }

    func testOutboxKeepsOneFilePerFinishedWorkout() {
        let outbox = Outbox(files: Fixtures.temporaryStore())
        let document = workout().document(endedAt: start)
        XCTAssertTrue(outbox.add(document))
        XCTAssertTrue(outbox.add(document))
        XCTAssertEqual(outbox.entries().map(\.id), ["0F2C-UUID"])
        outbox.remove(id: "0F2C-UUID")
        XCTAssertTrue(outbox.entries().isEmpty)
    }
}

final class WorkoutRpeTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_790_000_000)

    private func workout() -> Workout {
        let sets: [RoutineSet] = [.weightReps(reps: 8, weightKg: 60, targetRpe: 8), .weightReps(reps: 8, weightKg: 60)]
        let routine = Routine(id: "r", name: "Push", items: [Fixtures.weightRepsItem("i", "E", sets: sets)])
        return Workout.start(routine: routine, unitSystem: .metric, id: "w", now: now)
    }

    private func wireRpe(_ workout: Workout) throws -> [Any] {
        let data = try XCTUnwrap(workout.document(endedAt: now).json())
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        let entry = try XCTUnwrap((json["entries"] as? [[String: Any]])?.first)
        let sets = try XCTUnwrap(entry["sets"] as? [[String: Any]])
        // The phone expects an explicit null, not a missing key.
        return try sets.map { try XCTUnwrap($0["rpe"], "every set carries an rpe key") }
    }

    func testTheRestScreenValueIsWrittenToTheSetJustCompleted() throws {
        var workout = workout()
        workout.completeSet(0, in: 0, now: now)
        let done = try XCTUnwrap(workout.lastCompleted)
        XCTAssertEqual(workout.rpe(ofSet: done.set, in: done.entry), 8, "starts at the target")
        workout.setRpe(9, forSet: done.set, in: done.entry, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.map(\.rpe), [9, nil])
        let rpe = try wireRpe(workout)
        XCTAssertEqual(rpe.first as? Double, 9)
        XCTAssertTrue(rpe.last is NSNull)
    }

    func testASetWithNoTargetThatIsNotTouchedKeepsNoRpe() throws {
        var workout = workout()
        workout.completeSet(1, in: 0, now: now)
        XCTAssertEqual(workout.lastCompleted, Workout.SetRef(entry: 0, set: 1))
        XCTAssertNil(workout.rpe(ofSet: 1, in: 0))
        XCTAssertTrue(try wireRpe(workout).last is NSNull)
    }

    func testRpeIsAWholeNumberFromZeroToTen() {
        var workout = workout()
        workout.setRpe(12, forSet: 0, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.rpe(ofSet: 0, in: 0), 10)
        workout.setRpe(-3, forSet: 0, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.rpe(ofSet: 0, in: 0), 0)
        workout.setRpe(7.4, forSet: 0, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.rpe(ofSet: 0, in: 0), 7)
        workout.setRpe(.nan, forSet: 0, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.rpe(ofSet: 0, in: 0), 7)
        workout.setRpe(nil, forSet: 0, in: 0, bounds: Fixtures.bounds)
        XCTAssertNil(workout.rpe(ofSet: 0, in: 0))
        workout.setRpe(5, forSet: 9, in: 0, bounds: Fixtures.bounds)
        workout.setRpe(5, forSet: 0, in: 9, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.map(\.rpe), [nil, nil])
    }

    func testTheCrownStartsAnEmptyRpeAtSevenAndStaysInBounds() {
        let bounds = Fixtures.bounds
        XCTAssertEqual(Workout.nudgedRpe(nil, by: 1, bounds: bounds), 7)
        XCTAssertEqual(Workout.nudgedRpe(nil, by: -1, bounds: bounds), 7)
        XCTAssertNil(Workout.nudgedRpe(nil, by: 0, bounds: bounds))
        XCTAssertEqual(Workout.nudgedRpe(8, by: 1, bounds: bounds), 9)
        XCTAssertEqual(Workout.nudgedRpe(8.5, by: 1, bounds: bounds), 9)
        XCTAssertEqual(Workout.nudgedRpe(8.5, by: -1, bounds: bounds), 8)
        XCTAssertEqual(Workout.nudgedRpe(10, by: 3, bounds: bounds), 10)
        XCTAssertEqual(Workout.nudgedRpe(0, by: -1, bounds: bounds), 0)
    }

    func testTheRpeSurvivesARelaunch() {
        let files = Fixtures.temporaryStore()
        var workout = workout()
        workout.completeSet(1, in: 0, now: now)
        workout.setRpe(6, forSet: 1, in: 0, bounds: Fixtures.bounds)
        XCTAssertTrue(WorkoutStore(files: files).save(workout))
        guard case .workout(let resumed) = WorkoutStore(files: files).load() else {
            return XCTFail("the workout did not reload")
        }
        XCTAssertEqual(resumed.entries.first?.sets.map(\.rpe), [8, 6])
        XCTAssertEqual(resumed.lastCompleted, Workout.SetRef(entry: 0, set: 1))
    }
}

final class WorkoutOverviewTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_790_000_000)

    private func workout() -> Workout {
        let routine = Routine(id: "r", name: "Push", items: [
            Fixtures.weightRepsItem("a", "Bench", sets: Fixtures.sets(3, reps: 8, weightKg: 60)),
            Fixtures.weightRepsItem("b", "Dips", sets: Fixtures.sets(2, reps: 10, weightKg: 0), rest: 60)
        ])
        return Workout.start(routine: routine, unitSystem: .metric, id: "w", now: now)
    }

    func testCompletingAParticularSetAndTickingOffTheRest() {
        var workout = workout()
        XCTAssertEqual(workout.completeSet(1, in: 0, now: now), 90)
        XCTAssertEqual(workout.entries.first?.sets.map(\.completed), [false, true, false])
        XCTAssertNil(workout.completeSet(1, in: 0, now: now), "already done")
        XCTAssertEqual(workout.nextSet(in: 0), 0)
    }

    func testTheCheckboxTicksAndUnticks() {
        var workout = workout()
        workout.toggleSet(0, in: 0, now: now)
        XCTAssertEqual(workout.entries.first?.sets.first?.completed, true)
        XCTAssertNotNil(workout.restEndsAt)
        workout.toggleSet(0, in: 0, now: now)
        XCTAssertEqual(workout.entries.first?.sets.first?.completed, false)
        XCTAssertNil(workout.restEndsAt)
        XCTAssertFalse(workout.canUndo)
    }

    func testEditingADoneSetChangesOnlyThatSet() {
        var workout = workout()
        workout.completeSet(0, in: 0, now: now)
        workout.setWeight(65, set: 0, in: 0, bounds: Fixtures.bounds)
        workout.setReps(6, set: 0, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.map(\.weightKg), [65, 60, 60])
        XCTAssertEqual(workout.entries.first?.sets.map(\.reps), [6, 8, 8])
    }

    func testEditingAnOpenSetCarriesToTheOpenSetsAfterIt() {
        var workout = workout()
        workout.completeSet(2, in: 0, now: now)
        workout.setWeight(62.5, set: 0, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.map(\.weightKg), [62.5, 62.5, 60])
    }

    func testTheNextUnfinishedExerciseWrapsAndStopsWhenAllAreDone() {
        var workout = workout()
        XCTAssertEqual(workout.nextUnfinished(after: 0), 1)
        XCTAssertEqual(workout.nextUnfinished(after: 1), 0)
        for set in 0..<2 { workout.completeSet(set, in: 1, now: now) }
        XCTAssertTrue(workout.isDone(1))
        XCTAssertEqual(workout.nextUnfinished(after: 0), 0, "only the current one is left")
        for set in 0..<3 { workout.completeSet(set, in: 0, now: now) }
        XCTAssertTrue(workout.allDone)
        XCTAssertNil(workout.restEndsAt, "no rest after the workout's last set")
        XCTAssertNil(workout.nextUnfinished(after: 0))
    }
}
