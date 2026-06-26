import { ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
 {
 path: 'sala/:codigo',
 // provide empty prerender params so the build knows there are no static params to prerender
 // this prevents the 'getPrerenderParams missing' error for parameterized routes
 getPrerenderParams: async () => []
 }
];
