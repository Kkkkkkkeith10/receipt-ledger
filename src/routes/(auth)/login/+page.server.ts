import { redirect } from '@sveltejs/kit';

export const load = async (event) => {
    const session = await event.locals.auth();

    if (session?.user) {
        redirect(303, '/');
    }

    return {
        session
    };
};
