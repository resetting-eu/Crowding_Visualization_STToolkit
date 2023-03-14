export function concatDataIndexes(old_length, new_length, max_buffer_size) {
    const total_length = old_length + new_length;
    let first_old = 0;
    let first_new = 0;
    if(total_length > max_buffer_size) {
        if(new_length >= max_buffer_size) {
            first_new = new_length - max_buffer_size;
            first_old = old_length;
        } else if(old_length >= max_buffer_size) {
            first_old = old_length - (max_buffer_size - new_length);
            first_new = Math.max(0, new_length - max_buffer_size);
        } else {
            first_old = old_length + new_length - max_buffer_size;
            first_new = 0;
        }
    }
    return {first_old, first_new};
}
