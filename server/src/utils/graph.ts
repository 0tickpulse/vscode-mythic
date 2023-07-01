/**
 * A directed graph that supports cycles.
 *
 * @template V The type of the vertices in the graph.
 * @template E The type of the edges in the graph.
 */
export class Graph<V, E = null> {
    vertices = new Set<V>();
    edges = new Map<V, Set<E>>();

    addVertex(vertex: V) {
        this.vertices.add(vertex);
    }
    addEdge(from: V, to: V, edge: E) {
        const edges = this.edges.get(from);
        if (edges) {
            edges.add(edge);
        } else {
            this.edges.set(from, new Set([edge]));
        }
    }
    getEdges(from: V) {
        return this.edges.get(from) ?? new Set<E>();
    }
    getVertices() {
        return this.vertices;
    }
    traverse(origin: V, callback: (vertex: V, edge: E) => void) {
        const visited = new Set<V>();
        const queue = [...this.getEdges(origin)];
        while (queue.length > 0) {
            const edge = queue.shift()!;
            const vertex = this.getVertex(edge);
            if (visited.has(vertex)) {
                continue;
            }
            visited.add(vertex);
            callback(vertex, edge);
            queue.push(...this.getEdges(vertex));
        }
    }
    traverseAll(callback: (vertex: V, edge: E) => void) {
        for (const vertex of this.vertices) {
            this.traverse(vertex, callback);
        }
    }
    getVertex(edge: E) {
        for (const [vertex, edges] of this.edges) {
            if (edges.has(edge)) {
                return vertex;
            }
        }
        throw new Error(`Edge ${edge} not found in graph`);
    }
    delete(vertex: V) {
        this.vertices.delete(vertex);
        this.edges.delete(vertex);
        for (const edges of this.edges.values()) {
            edges.delete(vertex as unknown as E);
        }
    }
}
