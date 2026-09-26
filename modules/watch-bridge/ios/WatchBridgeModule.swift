import ExpoModulesCore

/// The JS face of `WatchSessionManager`. Every function is safe to call with no paired watch:
/// `isSupported()` false makes the session a no-op and the inbox simply stays empty.
public class WatchBridgeModule: Module, WatchSessionListener {
  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events("onInboxChanged", "onSnapshotRequested")

    OnStartObserving {
      WatchSessionManager.shared.setListener(self)
    }

    OnStopObserving {
      WatchSessionManager.shared.setListener(nil)
    }

    Function("isSupported") {
      WatchSessionManager.shared.isSupported
    }

    Function("pushSnapshot") {
      (id: String, payload: String, contentKey: String, force: Bool, requestId: String?) in
      guard WatchSessionManager.shared.isSupported else { return }
      WatchSessionManager.shared.pushSnapshot(
        id: id, payload: payload, contentKey: contentKey, force: force, requestId: requestId
      )
    }

    AsyncFunction("listInbox") { () -> [[String: Any]] in
      WatchSessionManager.shared.listInbox()
    }

    AsyncFunction("ackInbox") { (id: String) in
      WatchSessionManager.shared.ackInbox(id: id)
    }

    AsyncFunction("rejectInbox") { (id: String) in
      WatchSessionManager.shared.rejectInbox(id: id)
    }
  }

  func watchSessionInboxChanged() {
    sendEvent("onInboxChanged", [:])
  }

  func watchSessionSnapshotRequested(requestId: String) {
    sendEvent("onSnapshotRequested", ["requestId": requestId])
  }
}
