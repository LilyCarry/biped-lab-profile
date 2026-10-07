/* Board geometry reused from the owner's imu_visualizer/static/app.js. */
  function createIMUBoard(pcbColor, labelText, scale = 1.0) {
    const group = new THREE.Group();
    group.scale.set(scale, scale, scale);

    // 1. PCB 基板 (蓝色/绿色/专属色阻焊油)
    const pcbGeo = new THREE.BoxGeometry(2.2, 0.08, 1.6);
    const pcbMat = new THREE.MeshStandardMaterial({
      color: pcbColor,
      roughness: 0.4,
      metalness: 0.2
    });
    const pcb = new THREE.Mesh(pcbGeo, pcbMat);
    pcb.castShadow = true;
    pcb.receiveShadow = true;
    group.add(pcb);

    // 2. MPU-6050 QFN 芯片本体
    const chipGeo = new THREE.BoxGeometry(0.6, 0.12, 0.6);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.2,
      metalness: 0.6
    });
    const chip = new THREE.Mesh(chipGeo, chipMat);
    chip.position.set(0, 0.08, 0);
    group.add(chip);

    // 芯片引脚与一脚圆点
    const dotGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16);
    const dotMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(-0.2, 0.145, -0.2);
    group.add(dot);

    // 3. 镀金排针 (8 Pin)
    const pinGroup = new THREE.Group();
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });
    for (let i = 0; i < 8; i++) {
      const pinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 12);
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(-0.8 + i * 0.23, -0.15, 0.7);
      pinGroup.add(pin);
    }
    group.add(pinGroup);

    // 4. 电源指示 LED (发光蓝绿色)
    const ledGeo = new THREE.BoxGeometry(0.12, 0.08, 0.08);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 0.8
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0.8, 0.07, -0.5);
    group.add(led);

    // 5. 坐标轴指示器 (红 X，绿 Y，蓝 Z)
    const axisGroup = new THREE.Group();
    const arrowLen = 1.0;
    // X (红色: Pitch/Roll 对应轴)
    const dirX = new THREE.Vector3(1, 0, 0);
    const arrowX = new THREE.ArrowHelper(dirX, new THREE.Vector3(0, 0.15, 0), arrowLen, 0xef4444, 0.2, 0.1);
    axisGroup.add(arrowX);
    // Y (绿色)
    const dirY = new THREE.Vector3(0, 1, 0);
    const arrowY = new THREE.ArrowHelper(dirY, new THREE.Vector3(0, 0.15, 0), arrowLen, 0x10b981, 0.2, 0.1);
    axisGroup.add(arrowY);
    // Z (蓝色)
    const dirZ = new THREE.Vector3(0, 0, 1);
    const arrowZ = new THREE.ArrowHelper(dirZ, new THREE.Vector3(0, 0.15, 0), arrowLen, 0x3b82f6, 0.2, 0.1);
    axisGroup.add(arrowZ);
    group.add(axisGroup);

    return group;
  }

