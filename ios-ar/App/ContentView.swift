import ARKit
import SwiftUI
import UIKit

struct ContentView: View {
    @StateObject private var experience = ARExperienceController()

    var body: some View {
        ZStack {
            ARSceneView(experience: experience)
                .ignoresSafeArea()

            DetectionOverlayView(detections: experience.detections) { detection in
                experience.showNutrition(for: detection)
            }
            .ignoresSafeArea()

            VStack(spacing: 12) {
                TrackingStatusView(
                    message: experience.trackingMessage,
                    modelMessage: experience.modelMessage
                )

                if !experience.detections.isEmpty {
                    detectionPicker
                }

                Spacer()

                if let placementMessage = experience.placementMessage {
                    Text(placementMessage)
                        .font(.subheadline.weight(.semibold))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .foregroundStyle(.white)
                        .background(.black.opacity(0.72), in: Capsule())
                        .padding(.horizontal)
                }

                controls
            }
            .padding(.top, 12)
            .padding(.bottom, 12)

            if experience.isNutritionCardPresented {
                NutritionCardView(
                    food: experience.selectedFood,
                    onClose: experience.closeNutritionCard
                )
                .transition(.opacity.combined(with: .scale(scale: 0.96)))
                .zIndex(2)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear(perform: experience.startSession)
        .onDisappear(perform: experience.pauseSession)
        .animation(.easeInOut(duration: 0.2), value: experience.isNutritionCardPresented)
    }

    private var detectionPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(experience.detections) { detection in
                    Button {
                        experience.confirmDetection(detection)
                    } label: {
                        Text("Forankre \(detection.food.displayName)")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(.black.opacity(0.72), in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(experience.hasAnchor(for: detection.food))
                }
            }
            .padding(.horizontal)
        }
    }

    private var controls: some View {
        VStack(spacing: 10) {
            if experience.isPlacementConfirmationRequired {
                HStack(spacing: 10) {
                    Button("Juster plassering") {
                        experience.adjustPendingPlacement()
                    }
                    .buttonStyle(SecondaryARButtonStyle())

                    Button("Bekreft plassering") {
                        experience.confirmPendingPlacement()
                    }
                    .buttonStyle(PrimaryARButtonStyle())
                }
            } else {
                HStack(spacing: 10) {
                    Button("Plasser testanker") {
                        experience.beginTestPlacement()
                    }
                    .buttonStyle(SecondaryARButtonStyle())
                    .disabled(experience.hasTestAnchor)

                    Button("Start ny skanning") {
                        experience.startNewScan()
                    }
                    .buttonStyle(PrimaryARButtonStyle())
                }
            }

            if experience.hasSelectedAnchor {
                Button("Fjern anker") {
                    experience.removeSelectedAnchor()
                }
                .font(.footnote.weight(.semibold))
                .tint(.white.opacity(0.9))
            }
        }
        .padding(.horizontal, 16)
    }
}

private struct DetectionOverlayView: View {
    let detections: [FoodDetection]
    let onSelect: (FoodDetection) -> Void

    var body: some View {
        GeometryReader { geometry in
            ForEach(detections) { detection in
                let box = detection.boundingBox
                let imageScale = max(
                    geometry.size.height,
                    geometry.size.width / detection.sourceImageAspect
                )
                let imageOffsetX = (geometry.size.width - detection.sourceImageAspect * imageScale) / 2
                let imageOffsetY = (geometry.size.height - imageScale) / 2
                let frame = CGRect(
                    x: imageOffsetX + box.minX * detection.sourceImageAspect * imageScale,
                    y: imageOffsetY + box.minY * imageScale,
                    width: box.width * detection.sourceImageAspect * imageScale,
                    height: box.height * imageScale
                )
                let labelY = frame.minY > 88 ? frame.minY - 38 : frame.maxY + 40

                RoundedRectangle(cornerRadius: 12)
                    .stroke(.cyan.opacity(0.9), lineWidth: 2)
                    .frame(width: frame.width, height: frame.height)
                    .position(x: frame.midX, y: frame.midY)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)

                Button {
                    onSelect(detection)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 5) {
                            Text("2D-SPORING")
                                .tracking(0.8)
                            Text("\(Int(detection.confidence * 100))%")
                        }
                        .font(.system(size: 9, weight: .bold, design: .rounded))
                        .foregroundStyle(.cyan)

                        Text("Dette er \(detection.food == .apple ? "et eple" : "en banan")")
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                        Text("Trykk for næringsinnhold")
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.78))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background {
                        RoundedRectangle(cornerRadius: 13)
                            .fill(.ultraThinMaterial)
                            .environment(\.colorScheme, .dark)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 13)
                            .stroke(.cyan.opacity(0.7), lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
                .position(
                    x: min(max(frame.midX, 100), geometry.size.width - 100),
                    y: min(max(labelY, 62), geometry.size.height - 70)
                )
            }
        }
    }
}

private struct PrimaryARButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(Color(red: 0.03, green: 0.10, blue: 0.14))
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .frame(maxWidth: .infinity)
            .background(Color.cyan.opacity(configuration.isPressed ? 0.72 : 0.92), in: Capsule())
    }
}

private struct SecondaryARButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .frame(maxWidth: .infinity)
            .background(.black.opacity(configuration.isPressed ? 0.8 : 0.64), in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.24), lineWidth: 1))
    }
}

struct ARSceneView: UIViewRepresentable {
    let experience: ARExperienceController

    func makeCoordinator() -> Coordinator {
        Coordinator(experience: experience)
    }

    func makeUIView(context: Context) -> ARView {
        let view = experience.arView
        let tap = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleTap(_:))
        )
        tap.name = "mathjelp-scene-tap"
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
        return view
    }

    func updateUIView(_ uiView: ARView, context: Context) {}

    final class Coordinator: NSObject {
        private let experience: ARExperienceController

        init(experience: ARExperienceController) {
            self.experience = experience
        }

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            guard let view = recognizer.view as? ARView else { return }
            experience.handleSceneTap(at: recognizer.location(in: view))
        }
    }
}
