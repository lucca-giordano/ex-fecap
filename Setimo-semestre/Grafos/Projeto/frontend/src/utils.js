export function getAvatarUrl(name, originalAvatar) {
    if (!name) return originalAvatar;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Módulo modesto para garantir que RGB gerado caia na calha Dark/Medium (0-149)
    const r = Math.abs(hash & 0xFF) % 150;
    const g = Math.abs((hash >> 8) & 0xFF) % 150;
    const b = Math.abs((hash >> 16) & 0xFF) % 150;
    const toHex = (c) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    const hexColor = `${toHex(r)}${toHex(g)}${toHex(b)}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${hexColor}&color=fff`;
}
