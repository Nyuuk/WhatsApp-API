export interface dataMessageInterface {
    text: string
    number: number
}

export interface QueueMessages {
    id: number
    number: string
    text: string
    last_response: string|null
    status: boolean
    count_retry: number
    max_retry: number
    created_at: Date
    updated_at: Date|null
    deleted_at: Date|null
}