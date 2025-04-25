/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    ApplicationRef,
    ComponentFactoryResolver,
    ComponentRef,
    Injectable,
    Injector,
    Type,
} from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class ComponentRendererService {
    private componentRefs = new Map<string, ComponentRef<any>>();

    constructor(
        private componentFactoryResolver: ComponentFactoryResolver,
        private appRef: ApplicationRef,
        private injector: Injector
    ) {}

    /**
     * Renders an Angular component to HTML string
     * @param component The component type to render
     * @param props Properties to pass to the component
     * @returns HTML string representation of the component
     */
    renderToString<T>(component: Type<T>, props: Partial<T> = {}): string {
        // Create component
        const factory =
            this.componentFactoryResolver.resolveComponentFactory(component);
        const componentRef = factory.create(this.injector);

        // Pass input properties to component
        Object.assign(componentRef.instance, props);

        // Trigger change detection
        this.appRef.attachView(componentRef.hostView);
        componentRef.changeDetectorRef.detectChanges();

        // Get DOM element
        const domElement = (componentRef.hostView as any).rootNodes[0];

        // Convert to HTML string
        const html = domElement.outerHTML;

        // Clean up
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();

        return html;
    }

    /**
     * Destroys a specific component by ID
     */
    destroyComponent(id: string): boolean {
        if (this.componentRefs.has(id)) {
            const componentRef = this.componentRefs.get(id);
            componentRef.destroy();
            this.componentRefs.delete(id);
            return true;
        }
        return false;
    }

    /**
     * Destroys all created components
     */
    destroyAll(): void {
        this.componentRefs.forEach((componentRef) => {
            componentRef.destroy();
        });
        this.componentRefs.clear();
    }
}
