import SwiftUI

func store(token: String, value: String?) {
    UserDefaults.standard.set(token, forKey: "apiToken")
    _ = value!
    _ = SecTrustSetExceptions(trust, exceptions as CFData)
}
