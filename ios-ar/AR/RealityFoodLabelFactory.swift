import RealityKit
import UIKit

enum RealityFoodLabelFactory {
    static func makeLabel(for food: FoodItem?) -> Entity {
        let root = Entity()
        root.name = "mathjelp-food-label"
        let uprightPanel = simd_quatf(
            angle: .pi / 2,
            axis: SIMD3<Float>(1, 0, 0)
        )

        var background = SimpleMaterial(
            color: UIColor(red: 0.025, green: 0.09, blue: 0.14, alpha: 0.88),
            isMetallic: false
        )
        background.blending = .transparent(opacity: 0.88)
        background.roughness = 0.34

        let panel = ModelEntity(
            mesh: .generatePlane(width: 0.25, depth: 0.13),
            materials: [background]
        )
        panel.name = "mathjelp-label-panel"
        panel.orientation = uprightPanel
        panel.components.set(
            CollisionComponent(shapes: [.generateBox(size: [0.25, 0.018, 0.13])])
        )
        root.addChild(panel)

        let eyebrow = makeText(
            food == nil ? "ROMANKRET TEST" : "MAT IDENTIFISERT",
            size: 0.012,
            color: UIColor(red: 0.35, green: 0.92, blue: 1, alpha: 1),
            weight: .bold
        )
        eyebrow.position = [-0.108, 0.041, 0.008]
        root.addChild(eyebrow)

        let title = makeText(
            food?.displayName ?? "Testanker",
            size: 0.025,
            color: .white,
            weight: .semibold
        )
        title.position = [-0.108, 0.005, 0.008]
        root.addChild(title)

        let hint = makeText(
            food == nil ? "Trykk for å teste" : "Trykk for næringsinnhold",
            size: 0.010,
            color: UIColor(red: 0.75, green: 0.9, blue: 0.95, alpha: 1),
            weight: .regular
        )
        hint.position = [-0.108, -0.035, 0.008]
        root.addChild(hint)

        let glow = ModelEntity(
            mesh: .generatePlane(width: 0.254, depth: 0.134),
            materials: [UnlitMaterial(color: UIColor.cyan.withAlphaComponent(0.12))]
        )
        glow.orientation = uprightPanel
        glow.position.z = -0.003
        root.addChild(glow)

        root.scale = SIMD3<Float>(repeating: 0.001)
        return root
    }

    private static func makeText(
        _ value: String,
        size: CGFloat,
        color: UIColor,
        weight: UIFont.Weight
    ) -> ModelEntity {
        let mesh = MeshResource.generateText(
            value,
            extrusionDepth: 0.0005,
            font: .systemFont(ofSize: size, weight: weight),
            containerFrame: .zero,
            alignment: .left,
            lineBreakMode: .byClipping
        )
        return ModelEntity(mesh: mesh, materials: [UnlitMaterial(color: color)])
    }
}
