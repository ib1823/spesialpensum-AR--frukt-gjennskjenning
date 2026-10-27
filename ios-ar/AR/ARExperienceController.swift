import ARKit
import Combine
import RealityKit
import SwiftUI
import UIKit

@MainActor
final class ARExperienceController: NSObject, ObservableObject {
    @Published private(set) var trackingMessage = "Starter AR-sporing …"
    @Published private(set) var modelMessage: String
    @Published private(set) var detections: [FoodDetection] = []
    @Published private(set) var placementMessage: String?
    @Published private(set) var isPlacementConfirmationRequired = false
    @Published private(set) var isNutritionCardPresented = false
    @Published private(set) var selectedFood: FoodItem?
    @Published private(set) var hasAnchors = false

    let arView: ARView

    var hasTestAnchor: Bool {
        placedAnchors.values.contains { $0.food == nil }
    }

    var hasSelectedAnchor: Bool {
        selectedAnchorID != nil
    }

    nonisolated let recognitionService: FoodRecognitionService
    private var placedAnchors: [UUID: PlacedAnchor] = [:]
    private var selectedAnchorID: UUID?
    private var pendingFood: FoodItem?
    private var pendingPlacement: PendingPlacement?
    private var isPlacementRequested = false
    private var hasStartedSession = false
    private var consecutiveEmptyRecognitions = 0
    private var detectionExpiryTask: Task<Void, Never>?

    override init() {
        arView = ARView(frame: .zero)
        recognitionService = FoodRecognitionService()
        modelMessage = recognitionService.statusMessage
        super.init()

        arView.session.delegate = self
        arView.automaticallyConfigureSession = false
    }

    func startSession() {
        guard !hasStartedSession else { return }
        guard ARWorldTrackingConfiguration.isSupported else {
            trackingMessage = "Denne enheten støtter ikke ARKit World Tracking."
            return
        }

        if !placedAnchors.isEmpty {
            startNewScan()
        }
        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic
        arView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
        hasStartedSession = true
        trackingMessage = "Flytt telefonen rolig for å finne og spore flater."
        modelMessage = "Laster SSD-MobileNetV1 …"
        recognitionService.load { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case .success:
                    self.modelMessage = self.recognitionService.statusMessage
                case let .failure(error):
                    self.modelMessage = "AI-modell utilgjengelig: \(error.localizedDescription)"
                }
            }
        }
    }

    func pauseSession() {
        guard hasStartedSession else { return }
        arView.session.pause()
        hasStartedSession = false
        detectionExpiryTask?.cancel()
        detections = []
    }

    func beginTestPlacement() {
        guard ensureTrackingIsReady() else { return }
        guard !hasTestAnchor else {
            placementMessage = "Et testanker finnes allerede. Fjern det eller start en ny skanning først."
            return
        }
        pendingFood = nil
        pendingPlacement = nil
        isPlacementRequested = true
        isPlacementConfirmationRequired = false
        placementMessage = "Pek på en flate for å plassere et romforankret testanker."
    }

    func confirmDetection(_ detection: FoodDetection) {
        guard ensureTrackingIsReady() else { return }
        guard !hasAnchor(for: detection.food) else {
            placementMessage = "Et \(detection.food.displayName.lowercased())-anker finnes allerede. Fjern det før ny plassering."
            return
        }
        pendingFood = detection.food
        pendingPlacement = nil
        isPlacementRequested = true
        isPlacementConfirmationRequired = false
        placementMessage = "Trykk på en flate ved siden av \(detection.food.displayName.lowercased()) for å plassere ankeret."
    }

    func handleSceneTap(at point: CGPoint) {
        if let entity = arView.entity(at: point),
           let anchorID = anchorID(for: entity) {
            selectAnchor(anchorID)
            return
        }

        guard isPlacementRequested else { return }
        guard ensureTrackingIsReady() else { return }

        if let food = pendingFood, hasAnchor(for: food) {
            placementMessage = "Et anker for denne matvaren finnes allerede."
            return
        }

        guard let result = raycast(at: point) else {
            placementMessage = "Fant ingen sporbar flate her. Beveg telefonen og prøv et nytt punkt."
            return
        }

        switch result.quality {
        case .detectedPlane:
            createAnchor(at: result.transform, food: pendingFood)
        case .estimatedPlane:
            pendingPlacement = PendingPlacement(transform: result.transform, food: pendingFood)
            isPlacementConfirmationRequired = true
            placementMessage = "Flaten er foreløpig anslått. Bekreft plasseringen eller juster med et nytt trykk."
        }
    }

    func confirmPendingPlacement() {
        guard let pendingPlacement else { return }
        createAnchor(at: pendingPlacement.transform, food: pendingPlacement.food)
    }

    func adjustPendingPlacement() {
        pendingPlacement = nil
        isPlacementRequested = true
        isPlacementConfirmationRequired = false
        placementMessage = "Trykk på flaten der hologrammet skal stå."
    }

    func closeNutritionCard() {
        isNutritionCardPresented = false
    }

    func showNutrition(for detection: FoodDetection) {
        selectedFood = detection.food
        selectedAnchorID = placedAnchors.values.first { $0.food == detection.food }?.id
        isNutritionCardPresented = true
    }

    func removeSelectedAnchor() {
        guard let selectedAnchorID else { return }
        removeAnchor(selectedAnchorID)
    }

    func startNewScan() {
        for id in Array(placedAnchors.keys) {
            removeAnchor(id)
        }
        clearDetections()
        pendingFood = nil
        pendingPlacement = nil
        isPlacementRequested = false
        isPlacementConfirmationRequired = false
        isNutritionCardPresented = false
        selectedFood = nil
        placementMessage = "Ny skanning er klar. Velg en modellgjenkjenning eller plasser et testanker."
    }

    func hasAnchor(for food: FoodItem) -> Bool {
        placedAnchors.values.contains { $0.food == food }
    }

    private func ensureTrackingIsReady() -> Bool {
        guard ARWorldTrackingConfiguration.isSupported else {
            trackingMessage = "Denne enheten støtter ikke ARKit World Tracking."
            return false
        }
        guard hasStartedSession else {
            trackingMessage = "Start AR-sporing før du plasserer et anker."
            return false
        }
        guard arView.session.currentFrame?.camera.trackingState == .normal else {
            placementMessage = "Sporingen er ikke klar. Flytt telefonen rolig til sporing gjenopprettes."
            return false
        }
        return true
    }

    private func receiveDetections(_ results: [FoodDetection]) {
        if results.isEmpty {
            consecutiveEmptyRecognitions += 1
            guard consecutiveEmptyRecognitions >= 2 else { return }
            clearDetections()
            return
        }

        consecutiveEmptyRecognitions = 0
        detectionExpiryTask?.cancel()
        detections = results
        detectionExpiryTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            guard !Task.isCancelled else { return }
            self?.clearDetections()
        }
    }

    private func clearDetections() {
        detectionExpiryTask?.cancel()
        detectionExpiryTask = nil
        consecutiveEmptyRecognitions = 0
        detections = []
    }

    private func raycast(at point: CGPoint) -> RaycastPlacement? {
        let query = arView.makeRaycastQuery(
            from: point,
            allowing: .existingPlaneGeometry,
            alignment: .any
        )
        if let query, let hit = arView.session.raycast(query).first,
           isValidTransform(hit.worldTransform) {
            return RaycastPlacement(transform: uprightTransform(at: hit.worldTransform), quality: .detectedPlane)
        }

        let estimatedQuery = arView.makeRaycastQuery(
            from: point,
            allowing: .estimatedPlane,
            alignment: .horizontal
        )
        if let estimatedQuery, let hit = arView.session.raycast(estimatedQuery).first,
           isValidTransform(hit.worldTransform) {
            return RaycastPlacement(transform: uprightTransform(at: hit.worldTransform), quality: .estimatedPlane)
        }
        return nil
    }

    private func uprightTransform(at hitTransform: simd_float4x4) -> simd_float4x4 {
        let position = SIMD3<Float>(
            hitTransform.columns.3.x,
            hitTransform.columns.3.y,
            hitTransform.columns.3.z
        )
        let cameraPosition = arView.session.currentFrame?.camera.transform.columns.3
            ?? SIMD4<Float>(position.x, position.y, position.z + 1, 1)
        var forward = SIMD3<Float>(cameraPosition.x - position.x, 0, cameraPosition.z - position.z)
        if simd_length_squared(forward) < 0.0001 {
            forward = SIMD3<Float>(0, 0, 1)
        }
        forward = simd_normalize(forward)
        let up = SIMD3<Float>(0, 1, 0)
        let right = simd_normalize(simd_cross(up, forward))

        var transform = matrix_identity_float4x4
        transform.columns.0 = SIMD4<Float>(right.x, right.y, right.z, 0)
        transform.columns.1 = SIMD4<Float>(up.x, up.y, up.z, 0)
        transform.columns.2 = SIMD4<Float>(forward.x, forward.y, forward.z, 0)
        transform.columns.3 = SIMD4<Float>(position.x, position.y, position.z, 1)
        return transform
    }

    private func createAnchor(at transform: simd_float4x4, food: FoodItem?) {
        guard isValidTransform(transform) else {
            placementMessage = "Plasseringen var ugyldig. Prøv et annet punkt."
            return
        }
        if let food, hasAnchor(for: food) {
            placementMessage = "Et anker for denne matvaren finnes allerede."
            return
        }
        if food == nil, hasTestAnchor {
            placementMessage = "Et testanker finnes allerede. Fjern det eller start en ny skanning først."
            return
        }

        let anchorID = UUID()
        let anchorName = food.map { "mathjelp.\($0.rawValue)" } ?? "mathjelp.spatial-test"
        let arAnchor = ARAnchor(name: anchorName, transform: transform)
        arView.session.add(anchor: arAnchor)

        let anchorEntity = AnchorEntity(anchor: arAnchor)
        let label = RealityFoodLabelFactory.makeLabel(for: food)
        label.name = "mathjelp-anchor-\(anchorID.uuidString)"
        label.position = [0, 0.18, 0]
        anchorEntity.addChild(label)
        arView.scene.anchors.append(anchorEntity)
        label.move(
            to: Transform(
                scale: SIMD3<Float>(repeating: 1),
                rotation: simd_quatf(angle: 0, axis: SIMD3<Float>(0, 1, 0)),
                translation: label.position
            ),
            relativeTo: anchorEntity,
            duration: 0.28,
            timingFunction: .easeOut
        )

        placedAnchors[anchorID] = PlacedAnchor(
            id: anchorID,
            sessionAnchor: arAnchor,
            food: food,
            anchorEntity: anchorEntity
        )
        selectedAnchorID = anchorID
        selectedFood = food
        hasAnchors = true
        isNutritionCardPresented = false
        pendingFood = nil
        pendingPlacement = nil
        isPlacementRequested = false
        isPlacementConfirmationRequired = false
        placementMessage = food == nil
            ? "Testankeret er forankret i verdenskoordinater."
            : "\(food?.displayName ?? "Matvaren") er forankret. Trykk på hologrammet for næringsinnhold."
    }

    private func selectAnchor(_ id: UUID) {
        guard let anchor = placedAnchors[id] else { return }
        selectedAnchorID = id
        selectedFood = anchor.food
        isNutritionCardPresented = true
        placementMessage = nil
    }

    private func removeAnchor(_ id: UUID) {
        guard let anchor = placedAnchors.removeValue(forKey: id) else { return }
        arView.session.remove(anchor: anchor.sessionAnchor)
        arView.scene.anchors.remove(anchor.anchorEntity)

        if selectedAnchorID == id {
            selectedAnchorID = nil
            selectedFood = nil
            isNutritionCardPresented = false
        }
        hasAnchors = !placedAnchors.isEmpty
        placementMessage = "Det valgte romankeret er fjernet."
    }

    private func anchorID(for entity: Entity) -> UUID? {
        var current: Entity? = entity
        while let candidate = current {
            if candidate.name.hasPrefix("mathjelp-anchor-") {
                return UUID(
                    uuidString: String(candidate.name.dropFirst("mathjelp-anchor-".count))
                )
            }
            current = candidate.parent
        }
        return nil
    }

    private func isValidTransform(_ transform: simd_float4x4) -> Bool {
        let values = [
            transform.columns.0.x, transform.columns.0.y, transform.columns.0.z,
            transform.columns.1.x, transform.columns.1.y, transform.columns.1.z,
            transform.columns.2.x, transform.columns.2.y, transform.columns.2.z,
            transform.columns.3.x, transform.columns.3.y, transform.columns.3.z
        ]
        return values.allSatisfy(\.isFinite)
    }
}

extension ARExperienceController: ARSessionDelegate {
    nonisolated func session(_ session: ARSession, didUpdate frame: ARFrame) {
        let state = frame.camera.trackingState
        guard case .normal = state else {
            return
        }

        let orientation = CGImagePropertyOrientation.currentDeviceOrientation
        recognitionService.recognize(
            pixelBuffer: frame.capturedImage,
            orientation: orientation
        ) { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case let .success(detections):
                    self.receiveDetections(detections)
                case let .failure(error):
                    self.modelMessage = "AI-gjenkjenning feilet: \(error.localizedDescription)"
                    self.clearDetections()
                }
            }
        }
    }

    nonisolated func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        let state = camera.trackingState
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.trackingMessage = Self.message(for: state)
            if case .normal = state {
                return
            }
            self.clearDetections()
        }
    }

    nonisolated func session(_ session: ARSession, didFailWithError error: Error) {
        Task { @MainActor [weak self] in
            self?.trackingMessage = "AR-økten feilet: \(error.localizedDescription)"
        }
    }

    nonisolated func sessionWasInterrupted(_ session: ARSession) {
        Task { @MainActor [weak self] in
            self?.clearDetections()
            self?.trackingMessage = "Sporingen ble avbrutt. Hold enheten mot omgivelsene mens ARKit gjenoppretter."
        }
    }

    nonisolated func sessionInterruptionEnded(_ session: ARSession) {
        Task { @MainActor [weak self] in
            self?.trackingMessage = "ARKit forsøker å gjenopprette sporingen."
        }
    }

    private static func message(for state: ARCamera.TrackingState) -> String {
        switch state {
        case .normal:
            "AR-sporing aktiv."
        case let .limited(reason):
            switch reason {
            case .initializing:
                "Starter sporing. Beveg telefonen rolig."
            case .excessiveMotion:
                "Telefonen beveges for raskt. Hold den roligere."
            case .insufficientFeatures:
                "For få synlige detaljer. Pek mot en godt belyst flate."
            case .relocalizing:
                "Gjenoppretter tidligere sporing og ankerplasseringer."
            @unknown default:
                "Sporingen er begrenset. Beveg telefonen rolig."
            }
        case .notAvailable:
            "AR-sporing er utilgjengelig. Beveg telefonen og prøv igjen."
        }
    }
}

private struct RaycastPlacement {
    let transform: simd_float4x4
    let quality: Quality

    enum Quality {
        case detectedPlane
        case estimatedPlane
    }
}

private struct PendingPlacement {
    let transform: simd_float4x4
    let food: FoodItem?
}

private struct PlacedAnchor {
    let id: UUID
    let sessionAnchor: ARAnchor
    let food: FoodItem?
    let anchorEntity: AnchorEntity
}

private extension CGImagePropertyOrientation {
    static var currentDeviceOrientation: CGImagePropertyOrientation {
        switch UIDevice.current.orientation {
        case .portrait:
            .right
        case .portraitUpsideDown:
            .left
        case .landscapeLeft:
            .up
        case .landscapeRight:
            .down
        default:
            .right
        }
    }
}
