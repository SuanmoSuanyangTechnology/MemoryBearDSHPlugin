/**
 * MemoryBear-specific client context: the right sidebar is an optional service.
 *
 * @module dsh-memorybear/client/types
 */
import type { ClientContext } from '@redbear/dsh-memory-core/client';

export interface SidebarTabDefinition {
    id: string;
    kind: string;
    priority: string;
    title: () => unknown;
    guide: Array<{ id: string; order: number; title: () => unknown; description: () => unknown }>;
}

export interface SidebarTabsService {
    register(definition: SidebarTabDefinition): () => void;
}

/** Client context plus the optional right-sidebar service. */
export type MemoryBearClientContext = ClientContext<{ sidebarRightTabs: SidebarTabsService }>;

/** Context inside the optional sidebar child fiber. */
export type MemoryBearPanelContext = MemoryBearClientContext & { sidebarRightTabs: SidebarTabsService };
