// 360° scenes: Marzipano cube tiles in /public/assests/panoroma/tiles/<id>/{z}/{f}/{y}/{x}.jpg
// (512 px tiles, faces b d f l r u, levels 1–4, plus a 256 px preview strip). Values come
// from the Marzipano tool's data.js export. Add a floor by dropping its tile folder in and
// adding an entry here.
//
// `initial` is where the camera starts (radians): yaw 0 faces the green hills, positive
// yaw turns right, positive pitch looks down; fov is the vertical field of view.
export const PANO_BASE = '/assests/panoroma/tiles'

export const PANO_SCENES = [
  {
    id: '0-dji_0029_terrace-1501m',
    name: 'Terrace',
    meta: '150.1 m',
    initial: { yaw: 0.07648617417602921, pitch: 0.04285125902819331, fov: 1.4070723946101482 },
  },
  {
    id: '1-dji_0030_44th-floor_1443m',
    name: '44th Floor',
    meta: '144.3 m',
    initial: { yaw: -0.22207291326754408, pitch: 0, fov: 1.4070723946101482 },
  },
]

export const PANO_FACE_SIZE = 3600
export const PANO_LEVELS = [
  { tileSize: 256, size: 256, fallbackOnly: true },
  { tileSize: 512, size: 512 },
  { tileSize: 512, size: 1024 },
  { tileSize: 512, size: 2048 },
  { tileSize: 512, size: 4096 },
]
