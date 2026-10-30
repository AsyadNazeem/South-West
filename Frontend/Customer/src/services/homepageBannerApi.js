import api from './api';

export async function getHomepageBanners() {
    const response = await api.get('/store/homepage-banners');
    return response.data?.data ?? [];
}