import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import deepslateUrl from '../../assets/mc-textures/deepslate.png'
import copperUrl from '../../assets/mc-textures/copper_block.png'
import sculkUrl from '../../assets/mc-textures/sculk.png'
import furnaceUrl from '../../assets/mc-textures/furnace_front.png'
import obsidianUrl from '../../assets/mc-textures/obsidian.png'
import lanternUrl from '../../assets/mc-textures/lantern.png'

/**
 * Cofre 3D estilo MINECRAFT (voxel) — o botão JOGAR.
 *
 * Princípio AUTÊNTICO: nada de esticar 1 tile 16x16 sobre uma porta gigante.
 * Tudo é montado a partir de uma GRADE DE CUBOS UNITÁRIOS (1 bloco = 1x1x1 = 1 tile),
 * então a densidade de pixel fica exatamente como no Minecraft real.
 *
 * - Corpo/moldura: deepslate (búnker escuro).
 * - Porta: grade 4x4 de blocos de cobre (copper_block) com painel central de furnace_front
 *   pra parecer uma porta blindada metálica.
 * - Interior: parede de sculk com emissive verde tóxico (infectado) + PointLight verde.
 * - Roda/handwheel voxel de obsidian no centro da porta.
 * - Acentos: blocos de lantern luminosos nos cantos superiores.
 *
 * unlocking=true  -> porta ESCANCARA e fica aberta (jogo rodando); roda gira só enquanto abre, depois PARA.
 * unlocking=false -> fechado; roda gira devagar (idle), hover acelera.
 */
export default function Vault3D({ unlocking = false, onClick, disabled = false }) {
  const mountRef = useRef(null)
  const stateRef = useRef({ unlocking: false, hover: false })

  useEffect(() => { stateRef.current.unlocking = unlocking }, [unlocking])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let width = mount.clientWidth || 320
    let height = mount.clientHeight || 320

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(0, 0, 12)

    // --- Luzes: sombreamento flat de bloco (topo claro, lados médios, frente escura) ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.62))
    const key = new THREE.DirectionalLight(0xffffff, 1.3)
    key.position.set(-4, 8, 6)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x8fd14f, 0.28) // leve toque verde infectado nas bordas
    rim.position.set(5, -3, 4)
    scene.add(rim)
    // Luz verde tóxica vinda de dentro do cofre
    const toxic = new THREE.PointLight(0x7dff3a, 0.0, 22, 2)
    toxic.position.set(0, 0, -1.0)
    scene.add(toxic)

    // --- Texturas MC pixeladas (NEAREST, sem mipmap, sRGB) ---
    const texLoader = new THREE.TextureLoader()
    const textures = []
    const loadPix = (url) => {
      const t = texLoader.load(url)
      t.colorSpace = THREE.SRGBColorSpace
      t.magFilter = THREE.NearestFilter
      t.minFilter = THREE.NearestFilter
      t.generateMipmaps = false
      textures.push(t)
      return t
    }
    const deepslateTex = loadPix(deepslateUrl)
    const copperTex = loadPix(copperUrl)
    const sculkTex = loadPix(sculkUrl)
    const furnaceTex = loadPix(furnaceUrl)
    const obsidianTex = loadPix(obsidianUrl)
    const lanternTex = loadPix(lanternUrl)

    // --- Materiais flat (matte, visual de bloco — sem reflexo fotorrealista) ---
    const materials = []
    const mat = (tex, opts = {}) => {
      const m = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.0, roughness: 1.0, ...opts })
      materials.push(m)
      return m
    }
    const frameMat = mat(deepslateTex)
    const copperMat = mat(copperTex)
    const obsidianMat = mat(obsidianTex)
    const furnaceMat = mat(furnaceTex, { emissive: 0x6b1d00, emissiveIntensity: 0.25 })
    const sculkMat = mat(sculkTex, { emissive: 0x33ff14, emissiveIntensity: 0.85 })
    const lanternMat = mat(lanternTex, { emissive: 0xffcf6b, emissiveIntensity: 1.1 })

    // Geometria de bloco unitário reaproveitada (1x1x1) — 1 tile por face.
    const unit = new THREE.BoxGeometry(1, 1, 1)
    // Helper: 1 voxel (cubo unitário) na posição (x,y,z), opcionalmente escalado.
    const voxel = (parent, x, y, z, material, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(unit, material)
      m.position.set(x, y, z)
      m.scale.set(sx, sy, sz)
      parent.add(m)
      return m
    }

    const root = new THREE.Group()
    scene.add(root)

    // ============================================================
    // GRADE DE VOXELS
    // Convenção: a área da porta ocupa colunas/linhas -2..1 (grade 4x4),
    // a moldura é uma borda de 1 bloco em volta (-3..2), profundidade z.
    // ============================================================
    const G = 4              // grade da porta 4x4
    const start = -(G / 2)   // = -2  -> blocos centrados em -1.5..1.5
    const cell = (i) => start + 0.5 + i  // centro do bloco i (0..3) -> -1.5,-0.5,0.5,1.5

    const Z_BACK = -1.6      // parede de fundo (interior)
    const Z_FRAME = 0.0      // corpo/moldura
    const Z_DOOR = 0.55      // face frontal da porta

    // ---- Parede de fundo: grade 4x4 de sculk (interior infectado, brilha) ----
    const back = new THREE.Group()
    root.add(back)
    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        voxel(back, cell(i), cell(j), Z_BACK, sculkMat)
      }
    }

    // ---- Moldura/corpo: anel de blocos deepslate em volta da porta (borda larga) ----
    // Ocupa de -3..2 em x e y; a parte interna (porta) fica vazia.
    const frame = new THREE.Group()
    root.add(frame)
    const FRAME_MIN = -3, FRAME_MAX = 2  // índices da borda externa
    const innerMin = start, innerMax = start + G - 1 // -2..1 (área da porta + parede)
    for (let gx = FRAME_MIN; gx <= FRAME_MAX; gx++) {
      for (let gy = FRAME_MIN; gy <= FRAME_MAX; gy++) {
        const inside = gx >= innerMin && gx <= innerMax && gy >= innerMin && gy <= innerMax
        if (inside) continue // vão da porta fica vazio
        // corpo com profundidade (2 blocos fundos) pra dar sensação de búnker
        voxel(frame, gx + 0.5, gy + 0.5, Z_FRAME, frameMat, 1, 1, 2.4)
      }
    }

    // ---- Parafusos de obsidian nos 4 cantos da moldura ----
    const corners = [
      [FRAME_MIN + 0.5, FRAME_MAX + 0.5],
      [FRAME_MAX + 0.5, FRAME_MAX + 0.5],
      [FRAME_MIN + 0.5, FRAME_MIN + 0.5],
      [FRAME_MAX + 0.5, FRAME_MIN + 0.5],
    ]
    for (const [bx, by] of corners) {
      voxel(frame, bx, by, Z_FRAME + 0.8, obsidianMat, 0.55, 0.55, 0.4)
    }

    // ---- Lanternas (acento luminoso) nos cantos superiores ----
    for (const lx of [FRAME_MIN + 0.5, FRAME_MAX + 0.5]) {
      voxel(frame, lx, FRAME_MAX + 0.5, Z_FRAME + 1.25, lanternMat, 0.45, 0.6, 0.45)
    }

    // ============================================================
    // PORTA — grade 4x4 de cobre numa dobradiça à esquerda.
    // Pivot na borda esquerda do vão (x = innerMin = -2) pra girar como porta blindada.
    // ============================================================
    const doorPivot = new THREE.Group()
    doorPivot.position.set(innerMin, 0, Z_DOOR) // pivot na borda esquerda, à frente
    root.add(doorPivot)

    // blocos da porta posicionados RELATIVOS ao pivot (deslocados +0.5..+3.5 em x)
    const doorOffset = -innerMin // = 2 -> recoloca a grade da porta a partir do pivot
    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        // painel central (2x2 do meio) usa furnace_front pra dar cara de porta blindada
        const central = (i === 1 || i === 2) && (j === 1 || j === 2)
        const m = central ? furnaceMat : copperMat
        const vx = cell(i) + doorOffset
        const vy = cell(j)
        voxel(doorPivot, vx, vy, 0, m)
      }
    }
    // borda saliente da porta (frame fino de obsidian em volta, 1 bloco à frente rebaixado)
    // dá profundidade sem esticar textura.

    // ---- Dobradiça: 2 nós/cubos de obsidian no encaixe esquerdo entre porta e corpo ----
    for (const hy of [1.5, -1.5]) {
      // posicionados no root (não no pivot) pra ficarem fixos no encaixe
      voxel(root, innerMin - 0.05, hy, Z_DOOR, obsidianMat, 0.5, 0.7, 0.5)
    }

    // ---- Handwheel (volante) voxel no centro da porta ----
    const wheel = new THREE.Group()
    // centro da porta em coords do pivot: x = (cell(1.5)+doorOffset) ~ centro
    wheel.position.set(0 + doorOffset, 0, 0.65) // centro X da grade (0) + offset, à frente
    doorPivot.add(wheel)
    // cubo central
    voxel(wheel, 0, 0, 0, obsidianMat, 0.8, 0.8, 0.5)
    // 4 raios + pegadores nas pontas (cruz)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2
      const dx = Math.cos(a), dy = Math.sin(a)
      // raio: cubo alongado
      const spoke = voxel(wheel, dx * 0.85, dy * 0.85, 0, copperMat, 0.32, 1.3, 0.32)
      spoke.rotation.z = a + Math.PI / 2
      // pegador na ponta
      voxel(wheel, dx * 1.5, dy * 1.5, 0, obsidianMat, 0.5, 0.5, 0.4)
    }

    // ============================================================
    // ANIMAÇÃO
    // ============================================================
    let raf
    const clock = new THREE.Clock()
    function animate() {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime
      const { unlocking: u, hover } = stateRef.current

      // Porta: lerp da rotação.y em torno do pivot esquerdo.
      const targetDoor = u ? -1.95 : 0 // escancara ~112°
      doorPivot.rotation.y += (targetDoor - doorPivot.rotation.y) * Math.min(1, dt * 2.6)
      const settled = Math.abs(targetDoor - doorPivot.rotation.y) < 0.02

      // Roda: gira SÓ enquanto a porta se move; parada quando aberta; idle devagar quando fechado.
      let spin
      if (u) spin = settled ? 0 : 2.4
      else spin = hover ? 1.0 : 0.28
      wheel.rotation.z -= spin * dt

      // Respiração/tilt sutil no idle (é bloco, então bem discreto).
      root.rotation.y = Math.sin(t * 0.45) * 0.045
      root.rotation.x = Math.sin(t * 0.32) * 0.02

      // Brilho verde tóxico: forte/pulsante enquanto abre, calmo quando aberto, baixo quando fechado.
      const active = u && !settled
      let glow
      if (active) glow = 3.4 + Math.sin(t * 7) * 1.4
      else if (u) glow = 2.2 + Math.sin(t * 1.8) * 0.45
      else glow = 0.7 + Math.sin(t * 1.2) * 0.25
      toxic.intensity = glow
      sculkMat.emissiveIntensity = active ? 1.4 : (u ? 1.05 : 0.7)

      renderer.render(scene, camera)
    }
    animate()

    // --- Resize ---
    const onResize = () => {
      width = mount.clientWidth || width
      height = mount.clientHeight || height
      renderer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    // --- Pointer (hover acelera a roda no idle) ---
    const onEnter = () => { stateRef.current.hover = true }
    const onLeave = () => { stateRef.current.hover = false }
    mount.addEventListener('pointerenter', onEnter)
    mount.addEventListener('pointerleave', onLeave)

    // --- Cleanup completo ---
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mount.removeEventListener('pointerenter', onEnter)
      mount.removeEventListener('pointerleave', onLeave)
      unit.dispose()
      materials.forEach((m) => m.dispose())
      textures.forEach((tx) => tx.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      className={'vault3d' + (disabled ? ' is-disabled' : '')}
      ref={mountRef}
      role="button"
      onClick={disabled ? undefined : onClick}
      aria-label="Entrar na Zona"
    />
  )
}
