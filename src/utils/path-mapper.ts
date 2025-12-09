/**
 * Path mapper for translating between Docker container paths and host paths
 */

export class PathMapper {
  private mappings: Map<string, string> = new Map();

  constructor(mappings?: Record<string, string>) {
    if (mappings) {
      for (const [containerPath, hostPath] of Object.entries(mappings)) {
        this.addMapping(containerPath, hostPath);
      }
    }
  }

  addMapping(containerPath: string, hostPath: string): void {
    // Normalize paths (remove trailing slashes)
    const normalizedContainer = containerPath.replace(/\/+$/, '');
    const normalizedHost = hostPath.replace(/\/+$/, '');
    this.mappings.set(normalizedContainer, normalizedHost);
  }

  toHostPath(containerPath: string): string {
    const path = this.fromFileUri(containerPath);
    for (const [container, host] of this.mappings) {
      if (path.startsWith(container)) {
        return path.replace(container, host);
      }
    }
    return path;
  }

  toContainerPath(hostPath: string): string {
    for (const [container, host] of this.mappings) {
      if (hostPath.startsWith(host)) {
        return hostPath.replace(host, container);
      }
    }
    return hostPath;
  }

  toFileUri(path: string): string {
    if (path.startsWith('file://')) {
      return path;
    }
    return `file://${path}`;
  }

  fromFileUri(uri: string): string {
    if (uri.startsWith('file://')) {
      return uri.slice(7);
    }
    return uri;
  }

  getMappings(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [container, host] of this.mappings) {
      result[container] = host;
    }
    return result;
  }
}
