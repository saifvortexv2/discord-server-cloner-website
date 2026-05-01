const Joi = require("joi");

const validator = (req, res, next) => {
    try {
        const schema = Joi.object({
            token: Joi.string()
                .required()
                .messages({
                    'string.empty': 'Token is required',
                    'any.required': 'Token is required',
                }),
            copyId: Joi.string()
                .pattern(/^\d{17,20}$/)
                .required()
                .messages({
                    'string.pattern.base': 'Please enter a valid ID',
                    'string.empty': 'Server copy id is required',
                    'any.required': 'Server copy id is required'
                }),
            pasteId: Joi.string()
                .pattern(/^\d{17,20}$/)
                .required()
                .messages({
                    'string.pattern.base': 'Please enter a valid ID',
                    'string.empty': 'Server paste id is required',
                    'any.required': 'Server paste id is required'
                }),
            selectedOptions: Joi.object({
                all: Joi.boolean(),
                channels: Joi.boolean(),
                roles: Joi.boolean(),
                emojis: Joi.boolean()
            }).optional()
        }).unknown(false);


        const { error } = schema.validate(req.body);
        if (error) return res.status(400).json({ success: false, message: error.details[0].message });
        next();
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
}

module.exports = validator;