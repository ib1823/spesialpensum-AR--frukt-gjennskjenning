import CoreImage
import CoreVideo
import Foundation
import ImageIO
import OnnxRuntimeBindings

struct FoodDetection: Identifiable, Sendable {
    let food: FoodItem
    let confidence: Float
    let boundingBox: CGRect
    let sourceImageAspect: CGFloat

    var id: String {
        "\(food.rawValue)-\(Int(boundingBox.minX * 1000))-\(Int(boundingBox.minY * 1000))"
    }

    static func == (lhs: FoodDetection, rhs: FoodDetection) -> Bool {
        lhs.id == rhs.id
    }
}

extension FoodDetection: Equatable {}

final class FoodRecognitionService: @unchecked Sendable {
    private static let requiredOutputs: Set<String> = [
        "detection_boxes",
        "detection_classes",
        "detection_scores",
        "num_detections"
    ]
    private static let classIDs: [Int: FoodItem] = [
        52: .banana,
        53: .apple
    ]
    private static let confidenceThreshold: Float = 0.45
    private static let maximumInputDimension = 320
    private static let maximumDetections = 100

    private let queue = DispatchQueue(label: "no.mathjelp.iosar.onnx", qos: .userInitiated)
    private let lock = NSLock()
    private let modelURL: URL?
    private let imageContext = CIContext(options: [.useSoftwareRenderer: false])
    private var environment: ORTEnv?
    private var session: ORTSession?
    private var isLoading = false
    private var isInferenceScheduled = false
    private var lastScheduledTime = CFAbsoluteTime(0)
    private var storedStatusMessage: String

    var statusMessage: String {
        lock.lock()
        defer { lock.unlock() }
        return storedStatusMessage
    }

    init(bundle: Bundle = .main) {
        modelURL = bundle.url(
            forResource: "ssd-mobilenet-v1-12-int8",
            withExtension: "onnx"
        )
        storedStatusMessage = modelURL == nil
            ? "ONNX-modellen mangler i app-ressursene."
            : "Klargjør den innebygde eple- og bananmodellen …"
    }

    func load(completion: @escaping (Result<Void, Error>) -> Void) {
        lock.lock()
        guard !isLoading, session == nil else {
            let isReady = session != nil
            lock.unlock()
            completion(
                isReady
                    ? Result<Void, Error>.success(())
                    : Result<Void, Error>.failure(RecognitionError.modelLoading)
            )
            return
        }
        guard let modelURL else {
            lock.unlock()
            completion(Result<Void, Error>.failure(RecognitionError.modelMissing))
            return
        }
        isLoading = true
        storedStatusMessage = "Laster SSD-MobileNetV1 …"
        lock.unlock()

        queue.async { [weak self] in
            guard let self else { return }
            do {
                let environment = try ORTEnv(loggingLevel: .error)
                let options = try ORTSessionOptions()
                try options.setIntraOpNumThreads(2)
                let session = try ORTSession(
                    env: environment,
                    modelPath: modelURL.path,
                    sessionOptions: options
                )
                let inputNames = try session.inputNames()
                let outputNames = try session.outputNames()
                guard inputNames == ["inputs"],
                      Self.requiredOutputs.isSubset(of: Set(outputNames)) else {
                    throw RecognitionError.unexpectedModelInterface(
                        inputs: inputNames,
                        outputs: outputNames
                    )
                }

                self.lock.lock()
                self.environment = environment
                self.session = session
                self.isLoading = false
                self.storedStatusMessage = "SSD-MobileNetV1 klar. Viser eple og banan over modellens bildeboks."
                self.lock.unlock()
                completion(Result<Void, Error>.success(()))
            } catch {
                self.lock.lock()
                self.isLoading = false
                self.storedStatusMessage = "Modellinnlasting feilet: \(error.localizedDescription)"
                self.lock.unlock()
                completion(Result<Void, Error>.failure(error))
            }
        }
    }

    func recognize(
        pixelBuffer: CVPixelBuffer,
        orientation: CGImagePropertyOrientation,
        completion: @escaping (Result<[FoodDetection], Error>) -> Void
    ) {
        let now = CFAbsoluteTimeGetCurrent()
        lock.lock()
        guard session != nil else {
            lock.unlock()
            return
        }
        guard !isInferenceScheduled, now - lastScheduledTime >= 0.35 else {
            lock.unlock()
            return
        }
        isInferenceScheduled = true
        lastScheduledTime = now
        lock.unlock()

        queue.async { [weak self] in
            guard let self else { return }
            defer {
                self.lock.lock()
                self.isInferenceScheduled = false
                self.lock.unlock()
            }

            do {
                let (rgbPixels, width, height) = try self.makeRGBInput(
                    from: pixelBuffer,
                    orientation: orientation
                )
                let inputData = try rgbPixels.withUnsafeBytes { pixels in
                    guard let baseAddress = pixels.baseAddress else {
                        throw RecognitionError.invalidCameraFrame
                    }
                    return NSMutableData(bytes: baseAddress, length: pixels.count)
                }
                let input = try ORTValue(
                    tensorData: inputData,
                    elementType: .uInt8,
                    shape: [
                        1,
                        NSNumber(value: height),
                        NSNumber(value: width),
                        3
                    ]
                )

                self.lock.lock()
                let session = self.session
                self.lock.unlock()
                guard let session else { throw RecognitionError.modelNotLoaded }

                guard let outputs = try session.run(
                    withInputs: ["inputs": input],
                    outputNames: Self.requiredOutputs,
                    runOptions: nil
                ) else {
                    throw RecognitionError.missingOutputs
                }

                completion(Result<[FoodDetection], Error>.success(try Self.decode(
                    outputs: outputs,
                    sourceImageAspect: CGFloat(width) / CGFloat(height)
                )))
            } catch {
                completion(Result<[FoodDetection], Error>.failure(error))
            }
        }
    }

    private func makeRGBInput(
        from pixelBuffer: CVPixelBuffer,
        orientation: CGImagePropertyOrientation
    ) throws -> (pixels: [UInt8], width: Int, height: Int) {
        let orientedImage = CIImage(cvPixelBuffer: pixelBuffer).oriented(orientation)
        let extent = orientedImage.extent
        guard extent.width > 0, extent.height > 0,
              extent.width.isFinite, extent.height.isFinite else {
            throw RecognitionError.invalidCameraFrame
        }

        let scale = min(
            1,
            CGFloat(Self.maximumInputDimension) / max(extent.width, extent.height)
        )
        let width = max(1, Int((extent.width * scale).rounded()))
        let height = max(1, Int((extent.height * scale).rounded()))
        let bounds = CGRect(x: 0, y: 0, width: width, height: height)
        let normalizedImage = orientedImage
            .transformed(by: CGAffineTransform(translationX: -extent.minX, y: -extent.minY))
            .transformed(by: CGAffineTransform(scaleX: CGFloat(width) / extent.width, y: CGFloat(height) / extent.height))

        var rgba = [UInt8](repeating: 0, count: width * height * 4)
        imageContext.render(
            normalizedImage,
            toBitmap: &rgba,
            rowBytes: width * 4,
            bounds: bounds,
            format: .RGBA8,
            colorSpace: CGColorSpaceCreateDeviceRGB()
        )

        var rgb = [UInt8](repeating: 0, count: width * height * 3)
        for pixel in 0..<(width * height) {
            let source = pixel * 4
            let destination = pixel * 3
            rgb[destination] = rgba[source]
            rgb[destination + 1] = rgba[source + 1]
            rgb[destination + 2] = rgba[source + 2]
        }
        return (rgb, width, height)
    }

    private static func decode(
        outputs: [String: ORTValue],
        sourceImageAspect: CGFloat
    ) throws -> [FoodDetection] {
        guard let boxesValue = outputs["detection_boxes"],
              let classesValue = outputs["detection_classes"],
              let scoresValue = outputs["detection_scores"],
              let countValue = outputs["num_detections"] else {
            throw RecognitionError.missingOutputs
        }
        let boxes = try tensorFloats(boxesValue)
        let classes = try tensorFloats(classesValue)
        let scores = try tensorFloats(scoresValue)
        let counts = try tensorFloats(countValue)
        guard let reportedCount = counts.first, reportedCount.isFinite else {
            throw RecognitionError.invalidDetectionOutput
        }

        let availableCount = min(
            maximumDetections,
            boxes.count / 4,
            classes.count,
            scores.count
        )
        let safeCount = Int(
            min(max(0, reportedCount), Float(maximumDetections)).rounded(.down)
        )
        let count = min(safeCount, availableCount)
        var detections: [FoodDetection] = []

        for index in 0..<count {
            let score = scores[index]
            let rawClassID = classes[index]
            guard score.isFinite, score >= confidenceThreshold,
                  rawClassID.isFinite, rawClassID >= 0,
                  abs(rawClassID - rawClassID.rounded()) < 0.001,
                  let food = classIDs[Int(rawClassID.rounded())] else {
                continue
            }

            let offset = index * 4
            let yMin = boxes[offset]
            let xMin = boxes[offset + 1]
            let yMax = boxes[offset + 2]
            let xMax = boxes[offset + 3]
            guard [xMin, yMin, xMax, yMax].allSatisfy(\.isFinite),
                  xMin >= 0, yMin >= 0, xMax <= 1, yMax <= 1,
                  xMax > xMin, yMax > yMin else {
                continue
            }

            let candidate = FoodDetection(
                food: food,
                confidence: score,
                boundingBox: CGRect(
                    x: CGFloat(xMin),
                    y: CGFloat(yMin),
                    width: CGFloat(xMax - xMin),
                    height: CGFloat(yMax - yMin)
                ),
                sourceImageAspect: sourceImageAspect
            )
            guard !detections.contains(where: {
                $0.food == food && intersectionOverUnion($0.boundingBox, candidate.boundingBox) > 0.45
            }) else {
                continue
            }
            detections.append(candidate)
        }

        return detections.sorted { $0.confidence > $1.confidence }
    }

    private static func tensorFloats(_ value: ORTValue) throws -> [Float] {
        let tensorData = try value.tensorData()
        let data = Data(referencing: tensorData)
        guard data.count.isMultiple(of: MemoryLayout<Float>.size) else {
            throw RecognitionError.invalidDetectionOutput
        }
        return data.withUnsafeBytes { bytes in
            Array(bytes.bindMemory(to: Float.self))
        }
    }

    private static func intersectionOverUnion(_ first: CGRect, _ second: CGRect) -> CGFloat {
        let intersection = first.intersection(second)
        guard !intersection.isNull, !intersection.isEmpty else { return 0 }
        let unionArea = first.width * first.height + second.width * second.height - intersection.width * intersection.height
        return unionArea > 0 ? intersection.width * intersection.height / unionArea : 0
    }
}

private enum RecognitionError: LocalizedError {
    case modelMissing
    case modelLoading
    case modelNotLoaded
    case missingOutputs
    case invalidCameraFrame
    case invalidDetectionOutput
    case unexpectedModelInterface(inputs: [String], outputs: [String])

    var errorDescription: String? {
        switch self {
        case .modelMissing:
            "ONNX-modellen mangler i appens ressurser."
        case .modelLoading:
            "ONNX-modellen lastes allerede."
        case .modelNotLoaded:
            "ONNX-modellen er ikke lastet."
        case .missingOutputs:
            "Modellen leverte ikke de forventede SSD-deteksjonsutdataene."
        case .invalidCameraFrame:
            "Kamerarammen hadde ugyldige dimensjoner."
        case .invalidDetectionOutput:
            "Modellen leverte ugyldige tensorverdier."
        case let .unexpectedModelInterface(inputs, outputs):
            "Uventet ONNX-grensesnitt. Inputs: \(inputs); outputs: \(outputs)."
        }
    }
}
