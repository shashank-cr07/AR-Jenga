import * as THREE from './node_modules/three/src/Three.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import * as CANNON from 'cannon-es'
import { Wireframe } from 'three/examples/jsm/Addons.js';

// Main

let container;
let camera, scene, renderer;
let controller, reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let model;
let modelBody; // Add physics body for the model

const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.81, 0)
});

const timeStep = 1 / 10000; //Speed of frames

// //Creating a ground
//     const groundGeo=new THREE.PlaneGeometry(30,30);
//     const groundMat=new THREE.MeshBasicMaterial({
//         color:0xFFFFFF,
//         side:THREE.DoubleSide,
//         wireframe:true
//     });
//     const groundMesh=new THREE.Mesh(groundGeo,groundMat);
//     groundMesh.rotation.x = -Math.PI / 2;
//     groundMesh.position.y-=15;
    
    

//     const groundBody= new CANNON.Body({
//         shape:new CANNON.Plane()
//     });
    

// Initialize the scene, renderer, camera, and AR button
init();
animate();

function init() {
    container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();

    // scene.add(groundMesh);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);


    


    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // Add AR Button
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // GLTFLoader to load the model
    const loader = new GLTFLoader().setPath('assets/');
    loader.load('jenga.glb', (gltf) => {
        model = gltf.scene;

        // Use bounding box to determine the size of the model
        const boundingBox = new THREE.Box3().setFromObject(model);
        const size = boundingBox.getSize(new THREE.Vector3());

        // Log the size for debugging purposes
        console.log('Model Size:', size);

        // Adjust this scale factor based on the model size
        let scaleFactor = 1;

        // Apply the scale based on the size of the model
        model.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Hide the model until it is placed
        model.visible = false;
        scene.add(model);

        // Create a physics body for the model
        const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)); // Use Box shape for simplicity
        modelBody = new CANNON.Body({
            mass: 1, // Add mass for gravity to affect it
            position: new CANNON.Vec3(0, 5, 0), // Starting position
            shape: shape
        });
        world.addBody(modelBody);
    });

    // Reticle to indicate where the model can be placed
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.6, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Event listener for selecting and placing the model
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Handle window resizing
    window.addEventListener('resize', onWindowResize);
}

// Function to handle window resizing
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Function to handle the selection event (tapping the screen)
function onSelect() {
    if (reticle.visible && model) {
        // Place the model using the reticle position
        reticle.matrix.decompose(model.position, model.quaternion, model.scale);
        model.position.x -= 0.3; // To place it correctly in reticle
        model.position.y+=1;//To make it fall from a height

        // Sync the physics body's position with the model's position
        modelBody.position.set(model.position.x, model.position.y, model.position.z);
        console.log(model.position);
        model.visible = true;
        // world.addBody(groundBody);
    }
}

// Animation loop
function animate(timestamp, frame) {
    world.step(timeStep); // Step the physics world

    // groundMesh.position.copy(groundBody.position);
    // groundMesh.quaternion.copy(groundBody,quaternion);

    // Sync the Three.js model with the physics body
    if (model && modelBody) {
        model.position.copy(modelBody.position);
        model.quaternion.copy(modelBody.quaternion);
    }

    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then((viewerSpace) => {
                session.requestHitTestSource({ space: viewerSpace }).then((source) => {
                    hitTestSource = source;
                });
            });

            session.addEventListener('end', () => {
                hitTestSourceRequested = false;
                hitTestSource = null;
            });

            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);

            if (hitTestResults.length) {
                const hit = hitTestResults[0];
                const hitPose = hit.getPose(referenceSpace);

                // Make the reticle visible and position it at the hit test result
                reticle.visible = true;
                reticle.matrix.fromArray(hitPose.transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }

    renderer.render(scene, camera);
    renderer.setAnimationLoop(animate);
}
